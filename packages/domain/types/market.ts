export type InstrumentType = 'EQUITY' | 'INDEX' | 'FUTURE' | 'OPTION';

export interface Instrument {
  readonly symbol: string;
  readonly exchange: string;
  readonly type: InstrumentType;
  readonly lotSize: number;
  readonly tickSize: number;
  readonly isin?: string;
}

export type Timeframe = '1m' | '5m' | '15m' | '1d';

export interface Bar {
  readonly instrument: string;
  readonly timeframe: Timeframe;
  readonly timestamp: Date;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly vwap?: number;
}
