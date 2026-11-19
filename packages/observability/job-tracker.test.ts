import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobTracker } from './job-tracker.js';
import type { JobEventInput, JobStore } from './types.js';

function createStore(): {
  store: JobStore;
  events: JobEventInput[];
  begins: Parameters<JobStore['beginRun']>[0][];
  finished: Parameters<JobStore['finishRun']>[0][];
} {
  const events: JobEventInput[] = [];
  const begins: Parameters<JobStore['beginRun']>[0][] = [];
  const finished: Parameters<JobStore['finishRun']>[0][] = [];

  return {
    events,
    begins,
    finished,
    store: {
      beginRun: vi.fn<JobStore['beginRun']>(async (input) => {
        begins.push(input);
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
  it('enters the first stage and flushes on finish', async () => {
    vi.useFakeTimers();
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-1', stages: ['prepare', 'finalize'] });
    tracker.progress('run-1', 'prepare', { index: 1, total: 2 });
    expect(events).toHaveLength(0);

    await tracker.finish('run-1', { status: 'succeeded' });

    expect(events.map((event) => `${event.stage}:${event.type}`)).toEqual([
      'prepare:entered',
      'prepare:progress',
      'prepare:completed',
    ]);
  });

  it('flushes on the timer without waiting for finish', async () => {
    vi.useFakeTimers();
    const { store, events } = createStore();
    const tracker = new JobTracker(store, { flushMs: 500 });

    await tracker.begin({ jobRunId: 'run-2', stages: ['scan'] });
    tracker.progress('run-2', 'scan', { index: 1, total: 4 });
    expect(events).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(500);

    expect(events.map((event) => event.type)).toContain('progress');
  });

  it('emits entered and completed events around a stage', async () => {
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-3', stages: ['prepare', 'finalize'] });
    const result = await tracker.stage('run-3', 'prepare', async () => 7);
    await tracker.finish('run-3', { status: 'succeeded' });

    expect(result).toBe(7);
    expect(events.map((event) => `${event.stage}:${event.type}`)).toEqual([
      'prepare:entered',
      'prepare:completed',
    ]);
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

    const failed = events.find((event) => event.type === 'failed');
    expect(failed?.data?.message).toBe('boom');
  });

  it('redacts secret-looking keys before writing', async () => {
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-5', stages: ['fetch'] });
    tracker.progress('run-5', 'fetch', {
      authorization: 'Bearer secret',
      nested: { apiKey: 'abc', index: 2 },
    });
    await tracker.finish('run-5', { status: 'succeeded' });

    const progress = events.find((event) => event.type === 'progress');
    expect(progress?.data).toEqual({
      authorization: '[redacted]',
      nested: { apiKey: '[redacted]', index: 2 },
    });
  });

  it('never interrupts the job when the store fails', async () => {
    const onError = vi.fn<(error: unknown) => void>();
    const store: JobStore = {
      beginRun: vi.fn<JobStore['beginRun']>(async () => undefined),
      finishRun: vi.fn<JobStore['finishRun']>(async () => undefined),
      appendEvents: vi.fn<JobStore['appendEvents']>(async () => {
        throw new Error('database unavailable');
      }),
    };
    const tracker = new JobTracker(store, { onError });

    await tracker.begin({ jobRunId: 'run-6', stages: ['work'] });
    tracker.progress('run-6', 'work', { index: 1, total: 2 });
    await expect(tracker.finish('run-6', { status: 'succeeded' })).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(tracker.droppedEvents).toBeGreaterThan(0);
  });

  it('closes an open stage as failed and forwards the structured error', async () => {
    const { store, finished } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-7', stages: ['prepare', 'finalize'], attempt: 1 });
    tracker.enterStage('run-7', 'prepare');
    await tracker.finish('run-7', { status: 'failed', error: new Error('stopped') });

    expect(finished[0]?.error).toEqual({ code: 'job_failed', message: 'stopped' });
  });

  it('does not re-enter the same stage twice', async () => {
    const { store, events } = createStore();
    const tracker = new JobTracker(store);

    await tracker.begin({ jobRunId: 'run-8', stages: ['prepare', 'finalize'] });
    tracker.enterStage('run-8', 'prepare');
    tracker.enterStage('run-8', 'prepare');
    await tracker.finish('run-8', { status: 'succeeded' });

    expect(events.filter((event) => event.type === 'entered')).toHaveLength(1);
  });
});
