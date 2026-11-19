/**
 * @ai-trading/market-data
 * Provider-neutral normalization, session math, coverage and quality rules.
 * Keep framework-specific code out of this package.
 */

export type {
  BackfillPreview,
  BackfillScope,
  CalendarSessionRow,
  CandleUnit,
  CoverageStatus,
  CoverageVerdict,
  DataStatus,
  FetchStatus,
  GapRun,
  MonthChunk,
  NormalizationContext,
  NormalizationResult,
  NormalizedCandle,
  QualityFinding,
  QualityReason,
  QualityRule,
  RawCandle,
  SessionWindow,
} from './types.js';

export {
  addDays,
  addMinutes,
  daysBetween,
  eachDate,
  isoDate,
  isMinuteAligned,
  istToday,
  istTradingDate,
  maxDate,
  minDate,
  parseCandleTimestamp,
  sameMinute,
} from './time.js';

export {
  boundaryFindings,
  buildSessionWindow,
  diffMinutes,
  expectedMinutes,
  gapRuns,
  isWithinSession,
} from './sessions.js';

export {
  candleEquals,
  dedupeCandles,
  normalizeCandle,
  validateNormalizedCandle,
  type CandleValidation,
  type DedupeResult,
} from './candles.js';

export {
  computeCoverageVerdict,
  coverageStatus,
} from './coverage.js';

export {
  QUALITY_RULES,
  QUALITY_RULE_BY_ID,
  gapSeverity,
  isCriticalSeverity,
  qualityDedupeKey,
  qualityFinding,
  qualityRule,
} from './quality.js';

export {
  coverageCounts,
  deriveDataStatus,
  deriveFetchStatus,
  displayStatus,
  type DisplayStatus,
  type InstrumentStatusCounters,
} from './catalog.js';

export {
  HISTORY_START,
  datesBetween,
  lastCompletedSession,
  monthChunks,
  monthKey,
  nextDate,
  previewBackfill,
  selectMissingMonths,
  sessionsInWindow,
  targetWindow,
  validateBackfillRange,
} from './backfill.js';
