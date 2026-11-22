/** Queue states whose run will still be picked up, so the ledger row is not stale. */
const liveQueueStates = new Set([
  'waiting',
  'delayed',
  'prioritized',
  'waiting-children',
  'active',
]);

/**
 * Resolves the queue state of a `queued` ledger row to the status the run must close with.
 * `null` means leave the row alone: the queue still owns the run. A missing entry is the bug the
 * sweep exists for — the run will never start. A terminal state means the ledger fell behind.
 */
export function abandonedQueuedJobStatus(
  queueState: string | null,
): 'succeeded' | 'failed' | null {
  if (queueState === null) return 'failed';
  if (queueState === 'completed') return 'succeeded';
  if (queueState === 'failed') return 'failed';
  if (liveQueueStates.has(queueState)) return null;
  return 'failed';
}
