import { abandonedQueuedJobStatus } from './queued-job-state.js';

describe('abandonedQueuedJobStatus', () => {
  it('closes a run the queue does not hold', () => {
    expect(abandonedQueuedJobStatus(null)).toBe('failed');
  });

  it('leaves runs the queue still owns', () => {
    for (const state of ['waiting', 'delayed', 'prioritized', 'waiting-children', 'active']) {
      expect(abandonedQueuedJobStatus(state)).toBeNull();
    }
  });

  it('mirrors the terminal state when the ledger fell behind', () => {
    expect(abandonedQueuedJobStatus('completed')).toBe('succeeded');
    expect(abandonedQueuedJobStatus('failed')).toBe('failed');
  });

  it('treats an unknown queue state as abandoned', () => {
    expect(abandonedQueuedJobStatus('unknown')).toBe('failed');
  });
});
