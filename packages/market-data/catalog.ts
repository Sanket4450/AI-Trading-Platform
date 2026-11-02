import type { CoverageStatus, DataStatus, FetchStatus, ValidationStatus } from './types.js';

export interface InstrumentStatusCounters {
  expectedDays: number;
  completeDays: number;
  partialDays: number;
  missingDays: number;
  notApplicableDays: number;
  openCriticalIssues: number;
}

/**
 * Data status is derived from coverage and open issues, never from the HTTP
 * success of a fetch. Complete means every expected day is complete and no
 * critical issue is open.
 */
export function deriveDataStatus(counters: InstrumentStatusCounters): DataStatus {
  if (counters.expectedDays === 0) {
    return counters.notApplicableDays > 0 ? 'not_applicable' : 'pending';
  }
  if (counters.openCriticalIssues > 0) return 'needs_review';
  if (counters.missingDays > 0) return 'missing';
  if (counters.completeDays === counters.expectedDays) return 'complete';
  if (counters.partialDays > 0) return 'partial_mismatch';
  return 'pending';
}

export function deriveDataStatusWithValidation(input: {
  counters: InstrumentStatusCounters;
  reconciledDays: number;
  mismatchDays: number;
}): DataStatus {
  const base = deriveDataStatus(input.counters);
  if (base === 'partial_mismatch' && input.mismatchDays === 0 && input.reconciledDays > 0) {
    return 'partial_reconciled';
  }
  return base;
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
  | 'Gaps · reconciled'
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
  if (dataStatus === 'partial_reconciled') return 'Gaps · reconciled';
  if (dataStatus === 'not_applicable') return 'Not applicable';
  if (dataStatus === 'complete') return 'Complete';
  return 'Not fetched';
}

export function coverageCounts(rows: readonly { status: CoverageStatus }[]): {
  complete: number;
  partial: number;
  missing: number;
  notApplicable: number;
} {
  return rows.reduce(
    (counts, row) => {
      if (row.status === 'complete') counts.complete += 1;
      else if (row.status === 'partial') counts.partial += 1;
      else if (row.status === 'missing') counts.missing += 1;
      else counts.notApplicable += 1;
      return counts;
    },
    { complete: 0, partial: 0, missing: 0, notApplicable: 0 },
  );
}

export function validationCounts(
  rows: readonly { validationStatus: ValidationStatus }[],
): Record<ValidationStatus, number> {
  const counts: Record<ValidationStatus, number> = {
    not_checked: 0,
    pending: 0,
    matched: 0,
    volume_reconciled: 0,
    volume_mismatch: 0,
    ohlc_mismatch: 0,
    daily_missing: 0,
    minute_missing: 0,
    error: 0,
  };
  for (const row of rows) counts[row.validationStatus] += 1;
  return counts;
}
