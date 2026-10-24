import { describe, expect, it } from 'vitest';
import { openingRangeBreakout } from '@ai-trading/strategies';

describe('shared strategy contract', () => {
  it('exposes the opening-range-breakout identity and version', () => {
    expect(openingRangeBreakout.id).toBe('opening-range-breakout');
    expect(openingRangeBreakout.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('returns no signals until the R3 rules are implemented', () => {
    expect(openingRangeBreakout.evaluate()).toEqual([]);
  });
});
