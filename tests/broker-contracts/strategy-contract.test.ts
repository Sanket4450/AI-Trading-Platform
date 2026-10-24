import { describe, expect, it } from 'vitest';
import { openingRangeBreakout } from '@ai-trading/strategies';

describe('shared strategy contract', () => {
  it('exposes the opening-range-breakout identity and version', () => {
    expect(openingRangeBreakout.id).toBe('opening-range-breakout');
    expect(openingRangeBreakout.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('returns no signals until the R3 rules are implemented', () => {
    const context = {
      now: new Date('2026-01-01T03:45:00.000Z'),
      instrument: {
        symbol: 'NIFTY',
        exchange: 'NSE',
        type: 'INDEX' as const,
        lotSize: 1,
        tickSize: 0.05,
      },
      bars: [],
      position: null,
      config: {
        strategyId: 'opening-range-breakout',
        version: '0.1.0',
        parameters: {},
        tradingMode: 'offline' as const,
      },
    };

    expect(openingRangeBreakout.evaluate(context)).toEqual([]);
  });
});
