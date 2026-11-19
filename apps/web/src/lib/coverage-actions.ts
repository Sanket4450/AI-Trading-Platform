/**
 * Operator-facing copy for coverage actions. Instrument rows fall into three groups — never
 * successfully fetched, incomplete, and complete — so labels and dialogs stay honest about what
 * the fetch will actually request.
 */

export interface CoverageSignal {
  symbol: string;
  fetchStatus: string | null;
  dataStatus: string | null;
  lastSuccessAt: string | null;
  targetFrom: string | null;
  targetTo: string | null;
  expectedDays: number | null;
  completeDays: number | null;
  partialDays: number | null;
  missingDays: number | null;
}

export interface CoverageActionCopy {
  /** Short button and tooltip label; also the confirmation button. */
  label: string;
  /** Longer tooltip explanation. */
  tooltip: string;
  title: string;
  description: string;
}

const gapStatuses = new Set(['missing', 'partial_reconciled', 'partial_mismatch', 'needs_review']);

function windowLabel(signal: CoverageSignal): string {
  if (signal.targetFrom && signal.targetTo) return `${signal.targetFrom} → ${signal.targetTo}`;
  return 'the full target window';
}

/**
 * Copy for the fetch action, or null when there is nothing left to fetch (complete coverage).
 */
export function coverageFetchCopy(signal: CoverageSignal): CoverageActionCopy | null {
  if (signal.dataStatus === 'not_applicable') return null;
  if (signal.fetchStatus === 'queued' || signal.fetchStatus === 'fetching') return null;

  const complete = Math.max(signal.completeDays ?? 0, 0);
  const partial = Math.max(signal.partialDays ?? 0, 0);
  const missing = Math.max(signal.missingDays ?? 0, 0);
  const expected = signal.expectedDays ?? complete + partial + missing;
  const hasStoredData = Boolean(signal.lastSuccessAt) || complete + partial + missing > 0;

  if (!hasStoredData) {
    const retry = signal.fetchStatus === 'failed' || signal.fetchStatus === 'cancelled';
    return {
      label: retry ? 'Retry full fetch' : 'Fetch full history',
      tooltip: retry
        ? 'The last fetch did not finish — download the full target window'
        : 'No coverage yet — download the full target window',
      title: `${retry ? 'Retry the full fetch' : 'Fetch the full history'} for ${signal.symbol}?`,
      description: `${
        retry
          ? 'The previous attempt did not complete, so no successful coverage is stored.'
          : 'This instrument has never been fetched.'
      } The action requests every month in ${windowLabel(signal)} from the provider and writes the returned candles. Months that are already complete are skipped.`,
    };
  }

  const hasGaps = missing > 0 || partial > 0 || gapStatuses.has(signal.dataStatus ?? '');
  const stale = signal.fetchStatus === 'stale';

  if (hasGaps || stale) {
    if (!hasGaps) {
      return {
        label: 'Refresh stale coverage',
        tooltip: 'Provider data is marked stale — recheck the target window',
        title: `Refresh stale coverage for ${signal.symbol}?`,
        description: `Coverage for ${windowLabel(signal)} is marked stale. The action rechecks every month and downloads only the months that are not complete.`,
      };
    }
    return {
      label: 'Refresh missing months',
      tooltip: `${missing} missing · ${partial} partial of ${expected} days — fetch only gap months`,
      title: `Refresh missing months for ${signal.symbol}?`,
      description: `The target window ${windowLabel(signal)} has ${missing} missing and ${partial} partial days out of ${expected} scheduled days. The action requests only the months that are not complete and leaves complete months untouched.`,
    };
  }

  return null;
}

export function coverageCancelCopy(symbol: string): CoverageActionCopy {
  return {
    label: 'Cancel fetch',
    tooltip: 'Stop the in-flight fetch for this instrument',
    title: `Cancel the fetch for ${symbol}?`,
    description:
      'Cancellation stops the plan from starting new month chunks. The chunk already in flight finishes cleanly, and candles already written are kept.',
  };
}

export function coverageRecomputeCopy(symbol: string): CoverageActionCopy {
  return {
    label: 'Recompute status',
    tooltip: 'Recompute coverage and data status without downloading candles',
    title: `Recompute coverage for ${symbol}?`,
    description:
      'The action queues a status recompute that counts complete, partial and missing days and re-runs the validation rules. No candles are downloaded or modified.',
  };
}
