/**
 * The opening-range-breakout parameter contract. The seed and the strategy both import this
 * constant so the database schema and the evaluator cannot drift.
 */

export const ORB_STRATEGY_CODE = 'orb-15m';
export const ORB_IMPLEMENTATION = 'opening-range-breakout';
export const ORB_IMPLEMENTATION_VERSION = '1.0.0';
export const ORB_CODE_REF = `${ORB_IMPLEMENTATION}@${ORB_IMPLEMENTATION_VERSION}`;

export const ORB_STOP_MODES = ['breakout_candle_low_minus_tick'] as const;
export type OrbStopMode = (typeof ORB_STOP_MODES)[number];

export interface OrbParameters {
  readonly strategy?: string;
  readonly openingRangeStart: string;
  readonly openingRangeEnd: string;
  readonly signalTimeframe: '5m';
  readonly entryWindowStart: string;
  readonly entryWindowEnd: string;
  readonly emaFastPeriod: number;
  readonly emaSlowPeriod: number;
  readonly volumeLookbackSessions: number;
  readonly volumeRatioMin: number;
  readonly targetRMultiple: number;
  readonly maxEntriesPerDay: number;
  readonly maxOpenPositions: number;
  readonly eodExitTime: string;
  readonly vwapConfirmation?: boolean;
  readonly stopMode?: OrbStopMode;
  readonly maxEntriesPerStockPerSession?: number;
  readonly priceProtection?: boolean;
  readonly entryProtectionTicks?: number;
  readonly emaLookbackBars?: number;
  readonly marketInstrumentSymbol?: string;
  readonly marketInstrumentExchange?: string;
}

export type ResolvedOrbParameters = Required<Omit<OrbParameters, 'strategy'>> & {
  readonly strategy: string;
};

export const ORB_PARAMETER_DEFAULTS = {
  strategy: ORB_STRATEGY_CODE,
  openingRangeStart: '09:15',
  openingRangeEnd: '09:30',
  signalTimeframe: '5m',
  entryWindowStart: '09:30',
  entryWindowEnd: '14:15',
  emaFastPeriod: 20,
  emaSlowPeriod: 50,
  volumeLookbackSessions: 20,
  volumeRatioMin: 1.5,
  targetRMultiple: 1.5,
  maxEntriesPerDay: 2,
  maxOpenPositions: 1,
  eodExitTime: '15:15',
  vwapConfirmation: true,
  stopMode: 'breakout_candle_low_minus_tick',
  maxEntriesPerStockPerSession: 1,
  priceProtection: true,
  entryProtectionTicks: 1,
  emaLookbackBars: 200,
  marketInstrumentSymbol: 'NIFTY 50',
  marketInstrumentExchange: 'NSE',
} as const satisfies ResolvedOrbParameters;

/** JSON Schema stored on the strategy version and used by the registry validator. */
export const ORB_PARAMETER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'openingRangeStart',
    'openingRangeEnd',
    'signalTimeframe',
    'entryWindowStart',
    'entryWindowEnd',
    'emaFastPeriod',
    'emaSlowPeriod',
    'volumeLookbackSessions',
    'volumeRatioMin',
    'targetRMultiple',
    'maxEntriesPerDay',
    'maxOpenPositions',
    'eodExitTime',
  ],
  properties: {
    strategy: { type: 'string', const: ORB_STRATEGY_CODE },
    openingRangeStart: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    openingRangeEnd: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    signalTimeframe: { type: 'string', enum: ['5m'] },
    entryWindowStart: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    entryWindowEnd: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    emaFastPeriod: { type: 'integer', minimum: 1, maximum: 500 },
    emaSlowPeriod: { type: 'integer', minimum: 2, maximum: 500 },
    vwapConfirmation: { type: 'boolean' },
    volumeLookbackSessions: { type: 'integer', minimum: 1, maximum: 60 },
    volumeRatioMin: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
    stopMode: { type: 'string', enum: [...ORB_STOP_MODES] },
    targetRMultiple: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
    maxEntriesPerStockPerSession: { type: 'integer', minimum: 1, maximum: 100 },
    maxEntriesPerDay: { type: 'integer', minimum: 1, maximum: 100 },
    maxOpenPositions: { type: 'integer', minimum: 1, maximum: 10 },
    eodExitTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
    priceProtection: { type: 'boolean' },
    entryProtectionTicks: { type: 'integer', minimum: 0, maximum: 100 },
    emaLookbackBars: { type: 'integer', minimum: 50, maximum: 1000 },
    marketInstrumentSymbol: { type: 'string', minLength: 1, maxLength: 50 },
    marketInstrumentExchange: { type: 'string', minLength: 1, maxLength: 20 },
  },
} as const;

/** Applies the implementation defaults to an already validated payload. */
export function resolveOrbParameters(parameters: OrbParameters): ResolvedOrbParameters {
  return {
    ...ORB_PARAMETER_DEFAULTS,
    ...parameters,
    strategy: parameters.strategy ?? ORB_PARAMETER_DEFAULTS.strategy,
    vwapConfirmation: parameters.vwapConfirmation ?? ORB_PARAMETER_DEFAULTS.vwapConfirmation,
    stopMode: parameters.stopMode ?? ORB_PARAMETER_DEFAULTS.stopMode,
    maxEntriesPerStockPerSession:
      parameters.maxEntriesPerStockPerSession ??
      ORB_PARAMETER_DEFAULTS.maxEntriesPerStockPerSession,
    priceProtection: parameters.priceProtection ?? ORB_PARAMETER_DEFAULTS.priceProtection,
    entryProtectionTicks:
      parameters.entryProtectionTicks ?? ORB_PARAMETER_DEFAULTS.entryProtectionTicks,
    emaLookbackBars: parameters.emaLookbackBars ?? ORB_PARAMETER_DEFAULTS.emaLookbackBars,
    marketInstrumentSymbol:
      parameters.marketInstrumentSymbol ?? ORB_PARAMETER_DEFAULTS.marketInstrumentSymbol,
    marketInstrumentExchange:
      parameters.marketInstrumentExchange ?? ORB_PARAMETER_DEFAULTS.marketInstrumentExchange,
  };
}
