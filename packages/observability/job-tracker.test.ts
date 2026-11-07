import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobTracker } from './job-tracker.js';
import type { JobEventInput, JobStore } from './types.js';

function createStore(): {
  store: JobStore;
  events: JobEventInput[];
  stageUpdates: string[];
  finished: Parameters<JobStore['finishRun']>[0][];
} {
  const events: JobEventInput[] = [];
  const stageUpdates: string[] = [];
  const finished: Parameters<JobStore['finishRun']>[0][] = [];

  return {
    events,
    stageUpdates,
    finished,
    store: {
      beginRun: vi.fn<JobStore['beginRun']>(async () => undefined),
      setStage: vi.fn<JobStore['setStage']>(async (input) => {
        stageUpdates.push(input.stageKey);
      }),
      finishRun: vi.fn<JobStore['finishRun']>(async (input) => {
        finished.push(input);
      }),
      appendEvents: vi.fn<JobStore['appendEvents']>(async (batch) => {
        events.push(...batch);
      }),
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('JobTracker', () => {
  it('flushes buffered events when the run finishes', async () => {
    vi.useFakeTimers();
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-1', stages: ['start', 'work'] });
    tracker.step('run-1', 'first step');
    expect(events).toHaveLength(0);

    await tracker.finish('run-1', { status: 'succeeded' });

    expect(events.map((event) => event.message)).toEqual(
      expect.arrayContaining(['Job started', 'first step', 'Job finished']),
    );
  });

  it('flushes on the timer without waiting for finish', async () => {
    vi.useFakeTimers();
    const { store, events } = createStore();
    const tracker = new JobTracker(store, { flushMs: 500 });

    await tracker.begin({ jobRunId: 'run-2', stages: ['start'] });
    tracker.step('run-2', 'buffered');
    expect(events).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(500);

    expect(events.map((event) => event.message)).toContain('buffered');
  });

  it('emits entered and completed events around a stage', async () => {
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-3', stages: ['prepare', 'close'] });
    const result = await tracker.stage('run-3', 'prepare', async () => 7);
    await tracker.finish('run-3', { status: 'succeeded' });

    expect(result).toBe(7);
    const stageEvents = events.filter((event) => event.kind === 'stage');
    expect(stageEvents.map((event) => event.data?.phase)).toEqual(['entered', 'completed']);
    expect(stageEvents[1]?.data?.status).toBe('succeeded');
  });

  it('marks a failed stage and rethrows', async () => {
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-4', stages: ['fetch'] });
    await expect(
      tracker.stage('run-4', 'fetch', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await tracker.finish('run-4', { status: 'failed', error: new Error('boom') });

    const completed = events.find(
      (event) => event.kind === 'stage' && event.data?.phase === 'completed',
    );
    expect(completed?.data?.status).toBe('failed');
  });

  it('redacts secret-looking keys before writing', async () => {
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-5', stages: ['start'] });
    tracker.step('run-5', 'calling provider', {
      authorization: 'Bearer secret',
      nested: { apiKey: 'abc', attempt: 2 },
    });
    await tracker.finish('run-5', { status: 'succeeded' });

    const step = events.find((event) => event.message === 'calling provider');
    expect(step?.data).toEqual({
      authorization: '[redacted]',
      nested: { apiKey: '[redacted]', attempt: 2 },
    });
  });

  it('never interrupts the job when the store fails', async () => {
    const onError = vi.fn<(error: unknown) => void>();
    const store: JobStore = {
      beginRun: vi.fn<JobStore['beginRun']>(async () => undefined),
      setStage: vi.fn<JobStore['setStage']>(async () => undefined),
      finishRun: vi.fn<JobStore['finishRun']>(async () => undefined),
      appendEvents: vi.fn<JobStore['appendEvents']>(async () => {
        throw new Error('database unavailable');
      }),
    };
    const tracker = new JobTracker(store, { onError });

    await tracker.begin({ jobRunId: 'run-6', stages: ['start'] });
    tracker.step('run-6', 'still going');
    await expect(tracker.finish('run-6', { status: 'succeeded' })).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(tracker.droppedEvents).toBeGreaterThan(0);
  });

  it('reports the active stage on success and failure', async () => {
    const { store, finished } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-7', stages: ['prepare', 'close'] });
    tracker.enterStage('run-7', 'prepare');
    tracker.completeStage('run-7', 'prepare');
    tracker.enterStage('run-7', 'close');
    tracker.completeStage('run-7', 'close');
    await tracker.finish('run-7', { status: 'succeeded' });

    await tracker.begin({ jobRunId: 'run-8', stages: ['prepare', 'close'] });
    tracker.enterStage('run-8', 'prepare');
    await tracker.finish('run-8', { status: 'failed', error: new Error('stopped') });

    expect(finished[0]?.currentStage).toBe('close');
    expect(finished[1]?.currentStage).toBe('prepare');
  });
});
