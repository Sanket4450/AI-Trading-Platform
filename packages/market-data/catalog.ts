import type { DataStatus, FetchStatus } from './types.js';

export interface InstrumentStatusCounters {
  expectedDays: number;
  completeDays: number;
  partialDays: number;
  missingDays: number;
  openCriticalIssues: number;
}

/**
 * Data status is derived from coverage and open issues, never from the HTTP
 * success of a fetch. Complete means every expected day is complete and no
 * critical issue is open. `expectsData` is false when the instrument was not
 * listed inside the target window.
 */
export function deriveDataStatus(
  counters: InstrumentStatusCounters,
  expectsData: boolean,
): DataStatus {
  if (counters.expectedDays === 0) {
    return expectsData ? 'pending' : 'not_applicable';
  }
  if (counters.openCriticalIssues > 0) return 'needs_review';
  if (counters.missingDays > 0) return 'missing';
  if (counters.completeDays === counters.expectedDays) return 'complete';
  if (counters.partialDays > 0) return 'partial_mismatch';
  return 'pending';
}

export function deriveFetchStatus(input: {
  hasRun: boolean;
  queued: number;
  running: number;
  lastStatus: string | null;
  stale: boolean;
}): FetchStatus {
  if (input.stale) return 'stale';
  if (input.running > 0) return 'fetching';
  if (input.queued > 0) return 'queued';
  if (!input.hasRun) return 'not_requested';
  switch (input.lastStatus) {
    case 'succeeded':
      return 'fetched';
    case 'partially_failed':
      return 'partial';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'running':
      return 'fetching';
    case 'queued':
      return 'queued';
    default:
      return 'partial';
  }
}

/** Fetch status from the latest backfill run; the only evidence the catalog accepts for fetching. */
export function fetchStatusFromRun(
  latest: { status: string } | null,
  options: { stale?: boolean } = {},
): FetchStatus {
  return deriveFetchStatus({
    hasRun: Boolean(latest),
    queued: latest?.status === 'queued' ? 1 : 0,
    running: latest?.status === 'running' ? 1 : 0,
    lastStatus: latest?.status ?? null,
    stale: options.stale ?? false,
  });
}

export type DisplayStatus =
  | 'Failed'
  | 'Stopped'
  | 'Fetching'
  | 'Queued'
  | 'Verifying'
  | 'Needs review'
  | 'Missing'
  | 'Gaps · mismatch'
  | 'Stale'
  | 'Not applicable'
  | 'Complete'
  | 'Not fetched';

/** The single badge shown by the catalog, in the documented precedence order. */
export function displayStatus(input: {
  fetchStatus: FetchStatus | null;
  dataStatus: DataStatus | null;
  lastSuccessAt: Date | null;
  computedAt: Date | null;
}): DisplayStatus {
  const fetchStatus = input.fetchStatus;
  const dataStatus = input.dataStatus;
  if (fetchStatus === 'failed') return 'Failed';
  if (fetchStatus === 'cancelled') return 'Stopped';
  if (fetchStatus === 'fetching') return 'Fetching';
  if (fetchStatus === 'queued') return 'Queued';
  if (
    dataStatus === 'pending' ||
    (input.lastSuccessAt && input.computedAt && input.lastSuccessAt > input.computedAt)
  ) {
    return 'Verifying';
  }
  if (dataStatus === 'needs_review') return 'Needs review';
  if (dataStatus === 'missing') return 'Missing';
  if (dataStatus === 'partial_mismatch') return 'Gaps · mismatch';
  if (fetchStatus === 'stale') return 'Stale';
  if (dataStatus === 'not_applicable') return 'Not applicable';
  if (dataStatus === 'complete') return 'Complete';
  return 'Not fetched';
}
