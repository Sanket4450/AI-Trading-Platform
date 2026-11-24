/**
 * Plain-data vocabulary shared by the pure strategy evaluator, the worker and the API.
 * Nothing here imports a database, a queue or a framework.
 */

export type JsonSchema = Record<string, unknown>;

export type EvaluationRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type EvaluationResultStatus = 'signal' | 'no_signal' | 'skipped';

export const EVALUATION_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export const EVALUATION_RESULT_STATUSES = ['signal', 'no_signal', 'skipped'] as const;

export const STRATEGY_RUNTIME_STATUSES = [
  'registered',
  'unregistered',
  'invalid_code_ref',
  'implementation_missing',
  'schema_mismatch',
] as const;

export type StrategyRuntimeStatus = (typeof STRATEGY_RUNTIME_STATUSES)[number];

export const EVALUATION_REASON_CODES = [
  'no_breakout',
  'below_vwap',
  'market_filter',
  'volume_filter',
  'already_traded',
  'position_open',
  'daily_limit',
  'unsizeable',
  'invalid_stop',
  'invalid_tick',
  'vwap_unavailable',
  'volume_history_insufficient',
  'volume_history_zero',
  'opening_range_incomplete',
  'warmup',
  'decision_bar_incomplete',
  'coverage_missing',
  'coverage_partial',
  'index_missing',
  'index_insufficient_coverage',
  'index_data_gap',
  'special_session',
  'corporate_action',
  'session_missing',
] as const;

export type EvaluationReasonCode = (typeof EVALUATION_REASON_CODES)[number];

export const RESEARCH_SIGNAL_TYPES = ['entry', 'stop', 'target', 'eod'] as const;
export type ResearchSignalType = (typeof RESEARCH_SIGNAL_TYPES)[number];

export interface StrategyInstrument {
  readonly id: string;
  readonly symbol: string;
  readonly tickSize: number;
}

export interface VolumeSlotSample {
  readonly tradingDate: string;
  /** IST five-minute slot start, `HH:MM`. */
  readonly slot: string;
  readonly volume: number;
}

export interface RiskParameters {
  readonly riskPerTradePct: number;
  readonly maxOpenPositions: number;
  readonly maxEntriesPerDay: number;
}

export interface StrategySignalEvidence {
  evidenceVersion: 1;
  strategy: {
    code: string;
    codeRef: string;
    parameterHash: string | null;
  };
  session: {
    tradingDate: string;
    open: string;
    close: string;
  };
  openingRange: { high: number; low: number } | null;
  decisionBar: {
    start: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null;
  vwap: number | null;
  market: { symbol: string; close: number; emaFast: number; emaSlow: number } | null;
  volume: { slot: string; median: number; ratio: number } | null;
  pricing: {
    tickSize: number;
    referencePrice: number;
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    riskPerShare: number;
  } | null;
  sizing: {
    initialCapital: number;
    riskPerTradePct: number;
    byRisk: number;
    byCash: number;
    quantity: number;
  } | null;
  exitPlan: { stopMode: string; targetRMultiple: number } | null;
}

export interface StrategySignal {
  readonly instrumentId: string;
  readonly symbol: string;
  /** Instant the decision became known: the bar close. */
  readonly signalAt: Date;
  /** Instant the decision bar started. */
  readonly candleStart: Date;
  readonly signalType: ResearchSignalType;
  readonly side: 'long';
  readonly referencePrice: number;
  readonly entryPrice: number;
  readonly stopPrice: number;
  readonly targetPrice: number;
  readonly quantity: number;
  readonly evidence: StrategySignalEvidence;
}

export interface StrategyBreakoutCandidate {
  readonly barStart: string;
  readonly close: number;
  readonly breakout: boolean;
  readonly vwap: number | null;
  readonly marketPass: boolean;
  readonly volumeRatio: number | null;
  readonly qualified: boolean;
}

export interface StrategyResultDiagnostics {
  diagnosticsVersion: 1;
  readonly reason: EvaluationReasonCode | null;
  readonly coverage: {
    expectedBars: number | null;
    storedBars: number | null;
    indexExpectedBars: number | null;
    indexStoredBars: number | null;
  };
  readonly session: { tradingDate: string; open: string | null; close: string | null } | null;
  readonly openingRange: { high: number; low: number } | null;
  /** Bounded to at most 10 decision bars per instrument-day. */
  readonly candidates: readonly StrategyBreakoutCandidate[];
  readonly portfolio: { entries: number; openPositions: number };
  readonly note?: string;
}

export interface StrategyInstrumentResult {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly status: EvaluationResultStatus;
  readonly reasonCode: EvaluationReasonCode | null;
  readonly diagnostics: StrategyResultDiagnostics;
}

export interface StrategyEvaluation {
  readonly signals: readonly StrategySignal[];
  readonly results: readonly StrategyInstrumentResult[];
}

export interface StrategyRuntimeResolution {
  readonly status: StrategyRuntimeStatus;
  readonly code: string;
  readonly codeRef: string | null;
  readonly implementation: string | null;
  readonly implementationVersion: string | null;
  readonly schemaMatches: boolean | null;
  readonly parameterNames: readonly string[];
  readonly error: string | null;
}
