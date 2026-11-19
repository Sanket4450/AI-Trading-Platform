import {
  toJobError,
  type JobBeginInput,
  type JobEventInput,
  type JobFinishInput,
  type JobStageOutcome,
  type JobStore,
  type JobTrackerOptions,
} from './types.js';

interface RunState {
  jobRunId: string;
  stages: string[];
  startedAt: number;
  currentStage: string | null;
  entered: Set<string>;
  closed: Set<string>;
  stageStartedAt: Map<string, number>;
  buffer: JobEventInput[];
  timer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
  pendingFlush: boolean;
}

const secretKeyPattern = /token|secret|password|authorization|api[-_]?key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limit]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        secretKeyPattern.test(key) ? '[redacted]' : redact(item, depth + 1),
      ]),
    );
  }
  return value;
}

/**
 * Framework-agnostic run journal. Stages are fixed by the caller; every event is a fact
 * (`stage` + `type` + `data`). Writes are buffered and best-effort.
 */
export class JobTracker {
  private readonly runs = new Map<string, RunState>();
  private readonly flushMs: number;
  private readonly maxBuffer: number;
  private readonly onError?: (error: unknown) => void;
  private reported = false;
  private dropped = 0;

  constructor(
    private readonly store: JobStore,
    options: JobTrackerOptions = {},
  ) {
    this.flushMs = options.flushMs ?? 500;
    this.maxBuffer = options.maxBuffer ?? 50;
    this.onError = options.onError;
  }

  async begin(input: JobBeginInput): Promise<void> {
    const stages = input.stages.length > 0 ? input.stages : ['work'];
    const startedAt = input.startedAt ?? new Date();
    const state: RunState = {
      jobRunId: input.jobRunId,
      stages,
      startedAt: startedAt.getTime(),
      currentStage: stages[0] ?? null,
      entered: new Set(),
      closed: new Set(),
      stageStartedAt: new Map(),
      buffer: [],
      timer: null,
      flushing: false,
      pendingFlush: false,
    };
    this.runs.set(input.jobRunId, state);

    try {
      await this.store.beginRun({
        jobRunId: input.jobRunId,
        startedAt,
        attempt: input.attempt ?? 0,
      });
    } catch (error) {
      this.report(error);
    }

    this.enterStage(input.jobRunId, stages[0]!);
  }

  enterStage(jobRunId: string, stage: string): void {
    const state = this.runs.get(jobRunId);
    if (!state || state.entered.has(stage)) return;

    state.entered.add(stage);
    state.currentStage = stage;
    if (!state.stageStartedAt.has(stage)) state.stageStartedAt.set(stage, Date.now());

    this.append(state, { jobRunId, stage, type: 'entered' });
  }

  /** Records one unit of work inside a quantified stage. */
  progress(jobRunId: string, stage: string, data: Record<string, unknown>): void {
    const state = this.runs.get(jobRunId);
    if (!state) return;
    if (!state.entered.has(stage)) this.enterStage(jobRunId, stage);
    this.append(state, { jobRunId, stage, type: 'progress', data });
  }

  completeStage(
    jobRunId: string,
    stage: string,
    outcome: JobStageOutcome = 'completed',
    data?: Record<string, unknown>,
  ): void {
    const state = this.runs.get(jobRunId);
    if (!state || state.closed.has(stage)) return;
    if (!state.entered.has(stage)) this.enterStage(jobRunId, stage);

    const startedAt = state.stageStartedAt.get(stage);
    const durationMs = startedAt === undefined ? null : Date.now() - startedAt;
    state.closed.add(stage);
    state.stageStartedAt.delete(stage);
    if (state.currentStage === stage) state.currentStage = null;

    this.append(state, {
      jobRunId,
      stage,
      type: outcome,
      data: { ...data, durationMs },
    });
  }

  async stage<T>(
    jobRunId: string,
    stage: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    this.enterStage(jobRunId, stage);
    try {
      const result = await fn();
      this.completeStage(jobRunId, stage, 'completed');
      return result;
    } catch (error) {
      this.completeStage(jobRunId, stage, 'failed', {
        ...toJobError(error),
      });
      throw error;
    }
  }

  warning(jobRunId: string, stage: string, data: Record<string, unknown>): void {
    const state = this.runs.get(jobRunId);
    if (!state) return;
    if (!state.entered.has(stage)) this.enterStage(jobRunId, stage);
    this.append(state, { jobRunId, stage, type: 'warning', data });
  }

  async finish(jobRunId: string, input: JobFinishInput): Promise<void> {
    const state = this.runs.get(jobRunId);
    const failed = input.status === 'failed';

    if (state) {
      const open = state.currentStage;
      if (open && !state.closed.has(open)) {
        const startedAt = state.stageStartedAt.get(open);
        this.append(state, {
          jobRunId,
          stage: open,
          type: failed ? 'failed' : 'completed',
          data: {
            durationMs: startedAt === undefined ? null : Date.now() - startedAt,
            ...(failed ? toJobError(input.error) : {}),
          },
        });
        state.closed.add(open);
      }
      this.clearTimer(state);
      await this.flushRun(jobRunId);
    }

    try {
      await this.store.finishRun({
        jobRunId,
        status: input.status,
        error: failed ? toJobError(input.error) : null,
      });
    } catch (error) {
      this.report(error);
    }

    this.runs.delete(jobRunId);
  }

  async flushAll(): Promise<void> {
    for (const state of this.runs.values()) this.clearTimer(state);
    await Promise.allSettled([...this.runs.keys()].map((jobRunId) => this.flushRun(jobRunId)));
  }

  get droppedEvents(): number {
    return this.dropped;
  }

  private append(state: RunState, event: JobEventInput): void {
    state.buffer.push({
      ...event,
      occurredAt: new Date(),
      data: event.data ? (redact(event.data) as Record<string, unknown>) : undefined,
    });

    if (state.buffer.length >= this.maxBuffer) {
      void this.flushRun(state.jobRunId);
      return;
    }
    this.schedule(state);
  }

  private schedule(state: RunState): void {
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      void this.flushRun(state.jobRunId);
    }, this.flushMs);
  }

  private clearTimer(state: RunState): void {
    if (!state.timer) return;
    clearTimeout(state.timer);
    state.timer = null;
  }

  private async flushRun(jobRunId: string): Promise<void> {
    const state = this.runs.get(jobRunId);
    if (!state) return;

    this.clearTimer(state);
    if (state.flushing) {
      state.pendingFlush = true;
      return;
    }
    if (state.buffer.length === 0) return;

    state.flushing = true;
    const batch = state.buffer.splice(0, state.buffer.length);
    try {
      await this.store.appendEvents(batch);
    } catch (error) {
      this.dropped += batch.length;
      this.report(error);
    } finally {
      state.flushing = false;
      if (state.pendingFlush) {
        state.pendingFlush = false;
        await this.flushRun(jobRunId);
      }
    }
  }

  private report(error: unknown): void {
    if (this.reported) return;
    this.reported = true;
    this.onError?.(error);
  }
}
