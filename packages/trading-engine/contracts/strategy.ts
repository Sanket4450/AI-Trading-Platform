import type {
  Bar,
  JsonSchema,
  OrbParameters,
  RiskParameters,
  StrategyEvaluation,
  StrategyInstrument,
  VolumeSlotSample,
} from '@ai-trading/domain';

/** One IST trading session. Instants are UTC; every rule compares against these boundaries. */
export interface StrategySessionWindow {
  readonly tradingDate: string;
  readonly open: Date;
  readonly close: Date;
}

/**
 * Session-scoped strategy input. ORB limits are portfolio-wide, so the strategy sees the whole
 * universe for one day rather than one instrument at a time.
 */
export interface StrategySessionContext {
  /** Provenance only. No rule may read it. */
  readonly runAt: Date;
  readonly session: StrategySessionWindow;
  /** Tradable instruments, expected in symbol order. */
  readonly instruments: readonly StrategyInstrument[];
  /** Final 1-minute bars for the session, keyed by instrument id. */
  readonly bars: ReadonlyMap<string, readonly Bar[]>;
  /** NIFTY 50 1-minute bars covering the EMA lookback window and this session. */
  readonly indexBars: readonly Bar[];
  readonly indexInstrument: StrategyInstrument;
  /** Same-slot volume samples for the preceding complete sessions, keyed by instrument id. */
  readonly volumeHistory: ReadonlyMap<string, readonly VolumeSlotSample[]>;
  readonly initialCapital: number;
  readonly parameters: OrbParameters;
  readonly risk: RiskParameters;
  readonly codeRef: string;
  readonly parameterHash: string | null;
  /** Optional strict-coverage evidence supplied by the worker preflight. */
  readonly coverage?: {
    readonly expectedBars: number | null;
    readonly storedBars: number | null;
    readonly indexExpectedBars: number | null;
    readonly indexStoredBars: number | null;
  };
}

export interface Strategy {
  /** Database `strategies.code`. */
  readonly code: string;
  readonly implementation: string;
  readonly version: string;
  readonly parameterSchema: JsonSchema;
  evaluate(context: StrategySessionContext): StrategyEvaluation;
}
