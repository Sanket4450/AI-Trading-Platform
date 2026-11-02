/**
 * Provider-neutral contracts shared by ingestion, coverage and the operator
 * surface. The adapter converts Upstox tuples into RawCandle; nothing below
 * this package knows an Upstox key.
 */

export type CandleUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export type RawCandle = readonly [
  timestamp: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  openInterest?: number,
];

export interface NormalizedCandle {
  instrumentId: string;
  candleStart: Date;
  tradingDate: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  sourceProviderId: string;
  ingestionRunId: string;
  rawPayloadId: string;
  isFinal: boolean;
}

export interface NormalizationContext {
  instrumentId: string;
  sourceProviderId: string;
  ingestionRunId: string;
  rawPayloadId: string;
  session: SessionWindow | null;
  isFinal: boolean;
}

export type NormalizationResult =
  { ok: true; row: NormalizedCandle } | { ok: false; error: string; reason: QualityReason };

export type QualityReason =
  | 'invalid_timestamp'
  | 'non_minute_timestamp'
  | 'invalid_number'
  | 'invalid_price'
  | 'invalid_ohlc'
  | 'negative_volume'
  | 'outside_session'
  | 'non_trading_day'
  | 'duplicate_timestamp';

export interface SessionWindow {
  exchangeId: string;
  exchangeCode: string;
  tradingDate: string;
  open: Date;
  close: Date;
  expectedMinutes: number;
  isSpecial: boolean;
}

export interface CalendarSessionRow {
  exchangeId: string;
  exchangeCode?: string;
  tradingDate: string;
  isTradingDay: boolean;
  sessionOpen: Date | null;
  sessionClose: Date | null;
  description?: string | null;
}

export interface GapRun {
  start: Date;
  end: Date;
  minutes: number;
}

export type CoverageStatus = 'complete' | 'partial' | 'missing' | 'not_applicable';

export type ValidationStatus =
  | 'not_checked'
  | 'pending'
  | 'matched'
  | 'volume_reconciled'
  | 'volume_mismatch'
  | 'ohlc_mismatch'
  | 'daily_missing'
  | 'minute_missing'
  | 'error';

export interface CoverageVerdict {
  expectedBars: number;
  storedBars: number;
  missingBarCount: number;
  gapRunCount: number;
  maxGapMinutes: number;
  firstBarAt: Date | null;
  lastBarAt: Date | null;
  status: CoverageStatus;
  validationStatus: ValidationStatus;
  details: Record<string, unknown>;
}

export type FetchStatus =
  | 'not_requested'
  | 'queued'
  | 'fetching'
  | 'fetched'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'stale';

export type DataStatus =
  | 'complete'
  | 'partial_reconciled'
  | 'partial_mismatch'
  | 'missing'
  | 'pending'
  | 'not_applicable'
  | 'needs_review';

export interface MonthChunk {
  index: number;
  from: string;
  to: string;
}

export interface BackfillScope {
  instrumentIds: string[];
  from: string;
  to: string;
  mode: 'missing_only' | 'force';
}

export interface BackfillPreview {
  instrumentCount: number;
  sessionCount: number;
  monthCount: number;
  requestCount: number;
  estimatedBars: number;
  estimatedBytes: number;
  skippedMonths: number;
  months: MonthChunk[];
}

export interface QualityRule {
  ruleId: string;
  issueType: string;
  dimension: 'completeness' | 'validity' | 'consistency' | 'reference' | 'timeliness';
  defaultSeverity: 'info' | 'warning' | 'critical';
  description: string;
  blocksPreflightWhenCritical: boolean;
}

export interface QualityFinding {
  ruleId: string;
  issueType: string;
  severity: 'info' | 'warning' | 'critical';
  instrumentId: string | null;
  providerId: string | null;
  tradingDate: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  details: Record<string, unknown>;
  dedupeKey: string;
}
