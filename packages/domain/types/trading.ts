export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type OrderStatus =
  'PENDING' | 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export type SignalSide = 'LONG' | 'SHORT' | 'EXIT';

export interface Signal {
  readonly id: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly instrument: string;
  readonly side: SignalSide;
  readonly timestamp: Date;
  readonly entryPrice?: number;
  readonly stopLoss?: number;
  readonly target?: number;
  readonly reason?: string;
}

export interface PositionSnapshot {
  readonly instrument: string;
  readonly quantity: number;
  readonly averagePrice: number;
  readonly stopLoss?: number;
  readonly target?: number;
  readonly openedAt: Date;
}

export interface StrategyConfig {
  readonly strategyId: string;
  readonly version: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly tradingMode: 'offline' | 'research' | 'backtesting' | 'paper' | 'live';
}
