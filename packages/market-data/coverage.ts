import type {
  CoverageStatus,
  CoverageVerdict,
  GapRun,
  SessionWindow,
  ValidationStatus,
} from './types.js';
import { boundaryFindings, diffMinutes, expectedMinutes, gapRuns } from './sessions.js';

export interface DailyCandleValues {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface MinuteAggregate {
  open: string | null;
  high: string | null;
  low: string | null;
  close: string | null;
  volume: string;
  bars: number;
}

export interface ValidationComparison {
  status: ValidationStatus;
  ohlcMatch: boolean | null;
  volumeMatch: boolean | null;
  volumeDeltaPct: string | null;
  details: Record<string, unknown>;
}

const asNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function withinTick(a: number, b: number, tick: number): boolean {
  return Math.abs(a - b) <= Math.max(tick, 1e-9) + 1e-9;
}

/**
 * The daily candle is an independent witness, never a stored timeframe. It
 * distinguishes a no-trade gap from lost bars without synthesizing a minute.
 */
export function compareDailyToMinute(input: {
  daily: DailyCandleValues | null;
  minute: MinuteAggregate | null;
  tickSize: number;
  volumeTolerancePct: number;
}): ValidationComparison {
  const { daily, minute, tickSize, volumeTolerancePct } = input;
  if (!daily && !minute) {
    return {
      status: 'daily_missing',
      ohlcMatch: null,
      volumeMatch: null,
      volumeDeltaPct: null,
      details: { reason: 'no daily candle and no stored minute bars' },
    };
  }
  if (!daily) {
    return {
      status: 'daily_missing',
      ohlcMatch: null,
      volumeMatch: null,
      volumeDeltaPct: null,
      details: { reason: 'daily candle missing' },
    };
  }
  if (!minute || minute.bars === 0) {
    return {
      status: 'minute_missing',
      ohlcMatch: null,
      volumeMatch: null,
      volumeDeltaPct: null,
      details: { reason: 'daily candle exists but no minute bars were stored' },
    };
  }

  const dailyOpen = asNumber(daily.open);
  const dailyHigh = asNumber(daily.high);
  const dailyLow = asNumber(daily.low);
  const dailyClose = asNumber(daily.close);
  const dailyVolume = asNumber(daily.volume);
  const minuteOpen = asNumber(minute.open);
  const minuteHigh = asNumber(minute.high);
  const minuteLow = asNumber(minute.low);
  const minuteClose = asNumber(minute.close);
  const minuteVolume = asNumber(minute.volume);

  if (
    [
      dailyOpen,
      dailyHigh,
      dailyLow,
      dailyClose,
      dailyVolume,
      minuteOpen,
      minuteHigh,
      minuteLow,
      minuteClose,
      minuteVolume,
    ].some((value) => value === null)
  ) {
    return {
      status: 'error',
      ohlcMatch: null,
      volumeMatch: null,
      volumeDeltaPct: null,
      details: { reason: 'non-numeric daily or minute value' },
    };
  }

  const ohlcMatch =
    withinTick(dailyOpen!, minuteOpen!, tickSize) &&
    withinTick(dailyHigh!, minuteHigh!, tickSize) &&
    withinTick(dailyLow!, minuteLow!, tickSize) &&
    withinTick(dailyClose!, minuteClose!, tickSize);

  const volumeDeltaPct = dailyVolume === 0 ? null : (minuteVolume! - dailyVolume!) / dailyVolume!;
  const volumeMatch =
    dailyVolume === 0 ? minuteVolume === 0 : Math.abs(volumeDeltaPct!) <= volumeTolerancePct;

  const status: ValidationStatus = !ohlcMatch
    ? 'ohlc_mismatch'
    : !volumeMatch
      ? 'volume_mismatch'
      : 'matched';

  return {
    status,
    ohlcMatch,
    volumeMatch,
    volumeDeltaPct: volumeDeltaPct === null ? null : volumeDeltaPct.toFixed(10),
    details: {
      daily: {
        open: daily.open,
        high: daily.high,
        low: daily.low,
        close: daily.close,
        volume: daily.volume,
      },
      minute: {
        open: minute.open,
        high: minute.high,
        low: minute.low,
        close: minute.close,
        volume: minute.volume,
        bars: minute.bars,
      },
      tickSize,
      volumeTolerancePct,
    },
  };
}

export function coverageStatus(input: {
  session: SessionWindow | null;
  storedBars: number;
  missingBarCount: number;
  hasCriticalIssue: boolean;
}): CoverageStatus {
  if (!input.session) return 'not_applicable';
  if (input.storedBars === 0) return 'missing';
  if (input.missingBarCount === 0 && !input.hasCriticalIssue) return 'complete';
  return 'partial';
}

/**
 * Strict completeness is never relaxed by the oracle. The validation verdict
 * is stored beside it and may allow a bounded gap in a later preflight.
 */
export function computeCoverageVerdict(input: {
  session: SessionWindow | null;
  observed: readonly Date[];
  daily: DailyCandleValues | null;
  minute: MinuteAggregate | null;
  tickSize: number;
  volumeTolerancePct: number;
  hasCriticalIssue: boolean;
}): CoverageVerdict {
  if (!input.session) {
    return {
      expectedBars: 0,
      storedBars: 0,
      missingBarCount: 0,
      gapRunCount: 0,
      maxGapMinutes: 0,
      firstBarAt: null,
      lastBarAt: null,
      status: 'not_applicable',
      validationStatus: 'not_checked',
      details: { reason: 'not a scheduled trading session' },
    };
  }

  const expected = expectedMinutes(input.session);
  const observed = [...input.observed].sort((a, b) => a.getTime() - b.getTime());
  const missing = diffMinutes(expected, observed);
  const runs: GapRun[] = gapRuns(missing);
  const boundaries = boundaryFindings(expected, observed);
  const comparison = compareDailyToMinute({
    daily: input.daily,
    minute: input.minute,
    tickSize: input.tickSize,
    volumeTolerancePct: input.volumeTolerancePct,
  });

  const status = coverageStatus({
    session: input.session,
    storedBars: observed.length,
    missingBarCount: missing.length,
    hasCriticalIssue: input.hasCriticalIssue,
  });

  let validationStatus = comparison.status;
  if (
    validationStatus === 'matched' &&
    missing.length > 0 &&
    comparison.volumeMatch === true &&
    comparison.ohlcMatch === true
  ) {
    validationStatus = 'volume_reconciled';
  }

  return {
    expectedBars: expected.length,
    storedBars: observed.length,
    missingBarCount: missing.length,
    gapRunCount: runs.length,
    maxGapMinutes: runs.reduce((max, run) => Math.max(max, run.minutes), 0),
    firstBarAt: observed[0] ?? null,
    lastBarAt: observed[observed.length - 1] ?? null,
    status,
    validationStatus,
    details: {
      missingSample: missing.slice(0, 25).map((value) => value.toISOString()),
      gapRuns: runs.slice(0, 25).map((run) => ({
        start: run.start.toISOString(),
        end: run.end.toISOString(),
        minutes: run.minutes,
      })),
      missingOpen: boundaries.missingOpen,
      missingClose: boundaries.missingClose,
      comparison: comparison.details,
    },
  };
}
