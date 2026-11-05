import type {
  ProcessBeginInput,
  ProcessEventInput,
  ProcessFinishInput,
  ProcessStageStatus,
  ProcessStore,
  ProcessTrackerOptions,
} from './types.js';

interface RunState {
  jobRunId: string;
  stages: string[];
  startedAt: number;
  currentStage: string | null;
  buffer: ProcessEventInput[];
  timer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
  pendingFlush: boolean;
  stageStartedAt: Map<string, number>;
  /** Serializes stage writes so the database never ends on an older stage. */
  stageUpdate: Promise<void>;
}

const secretKeyPattern = /token|secret|password|authorization|api[-_]?key/i;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return 'Process failed';
}

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
 * Framework-agnostic run journal. Writes are buffered and best-effort: a
 * tracking failure is reported once and never interrupts the process.
 */
export class ProcessTracker {
  private readonly runs = new Map<string, RunState>();
  private readonly flushMs: number;
  private readonly maxBuffer: number;
  private readonly onError?: (error: unknown) => void;
  private reported = false;
  private dropped = 0;

  constructor(
    private readonly store: ProcessStore,
    options: ProcessTrackerOptions = {},
  ) {
    this.flushMs = options.flushMs ?? 500;
    this.maxBuffer = options.maxBuffer ?? 50;
    this.onError = options.onError;
  }

  async begin(input: ProcessBeginInput): Promise<void> {
    const startedAt = input.startedAt ?? new Date();
    const stages = input.stages.length > 0 ? input.stages : ['start'];
    const state: RunState = {
      jobRunId: input.jobRunId,
      stages,
      startedAt: startedAt.getTime(),
      currentStage: stages[0] ?? null,
      buffer: [],
      timer: null,
      flushing: false,
      pendingFlush: false,
      stageStartedAt: new Map(),
      stageUpdate: Promise.resolve(),
    };
    this.runs.set(input.jobRunId, state);

    this.append(state, {
      kind: 'lifecycle',
      message: 'Process started',
      data: { stages },
    });

    try {
      await this.store.beginRun({ jobRunId: input.jobRunId, stages, startedAt });
    } catch (error) {
      this.report(error);
    }
  }

  enterStage(jobRunId: string, key: string, message?: string): void {
    const state = this.runs.get(jobRunId);
    if (!state) return;

    state.currentStage = key;
    if (!state.stageStartedAt.has(key)) state.stageStartedAt.set(key, Date.now());

    this.append(state, {
      kind: 'stage',
      stageKey: key,
      message: message ?? `Entered ${key}`,
      data: { phase: 'entered' },
    });

    state.stageUpdate = state.stageUpdate
      .then(() => this.store.setStage({ jobRunId, stageKey: key }))
      .catch((error) => this.report(error));
  }

  completeStage(
    jobRunId: string,
    key: string,
    status: ProcessStageStatus = 'succeeded',
    message?: string,
  ): void {
    const state = this.runs.get(jobRunId);
    if (!state) return;

    const startedAt = state.stageStartedAt.get(key);
    const durationMs = startedAt === undefined ? null : Date.now() - startedAt;
    state.stageStartedAt.delete(key);

    this.append(state, {
      kind: 'stage',
      level: status === 'failed' ? 'error' : 'info',
      stageKey: key,
      message: message ?? `${status === 'failed' ? 'Failed' : 'Completed'} ${key}`,
      data: { phase: 'completed', status, durationMs },
    });
  }

  async stage<T>(jobRunId: string, key: string, fn: () => Promise<T>): Promise<T> {
    this.enterStage(jobRunId, key);
    try {
      const result = await fn();
      this.completeStage(jobRunId, key, 'succeeded');
      return result;
    } catch (error) {
      this.completeStage(jobRunId, key, 'failed');
      throw error;
    }
  }

  step(jobRunId: string, message: string, data?: Record<string, unknown>): void {
    const state = this.runs.get(jobRunId);
    if (!state) return;
    this.append(state, { kind: 'step', stageKey: state.currentStage, message, data });
  }

  metric(
    jobRunId: string,
    key: string,
    value: number,
    unit = 'count',
    data?: Record<string, unknown>,
  ): void {
    const state = this.runs.get(jobRunId);
    if (!state || !Number.isFinite(value)) return;
    this.append(state, {
      kind: 'metric',
      stageKey: state.currentStage,
      message: `${key} = ${value}`,
      metricKey: key,
      metricValue: value,
      metricUnit: unit,
      data,
    });
  }

  warn(jobRunId: string, message: string, data?: Record<string, unknown>): void {
    const state = this.runs.get(jobRunId);
    if (!state) return;
    this.append(state, {
      kind: 'warning',
      level: 'warn',
      stageKey: state.currentStage,
      message,
      data,
    });
  }

  async finish(jobRunId: string, input: ProcessFinishInput): Promise<void> {
    const state = this.runs.get(jobRunId);
    const failed = input.status === 'failed';
    const lastStage = state?.stages.at(-1) ?? null;
    const currentStage = state?.currentStage ?? (failed ? null : lastStage);

    if (state) {
      this.append(state, {
        kind: 'lifecycle',
        level: failed ? 'error' : 'info',
        message: failed ? 'Process failed' : 'Process finished',
        data: { status: input.status },
      });
      this.clearTimer(state);
      await this.flushRun(jobRunId);
      await state.stageUpdate;
    }

    const durationMs = state ? Date.now() - state.startedAt : null;

    try {
      await this.store.finishRun({
        jobRunId,
        status: input.status,
        currentStage,
        durationMs,
        summary: input.summary ?? null,
        errorMessage: failed ? errorMessage(input.error) : null,
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

  private append(state: RunState, event: Omit<ProcessEventInput, 'jobRunId' | 'occurredAt'>): void {
    state.buffer.push({
      ...event,
      jobRunId: state.jobRunId,
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
