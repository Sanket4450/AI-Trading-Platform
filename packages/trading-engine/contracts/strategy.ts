import type { Bar, Instrument, PositionSnapshot, Signal, StrategyConfig } from '@ai-trading/domain';

export interface StrategyContext {
  readonly now: Date;
  readonly instrument: Instrument;
  readonly bars: readonly Bar[];
  readonly position: PositionSnapshot | null;
  readonly config: StrategyConfig;
}

export interface Strategy {
  readonly id: string;
  readonly version: string;
  evaluate(context: StrategyContext): readonly Signal[];
}
