import { describe, expect, it } from 'vitest';
import { roundToTick } from './pricing.js';

describe('roundToTick', () => {
  it('rounds to the nearest ₹0.05 tick', () => {
    expect(roundToTick(101.03, 0.05)).toBe(101.05);
    expect(roundToTick(101.01, 0.05)).toBe(101);
    expect(roundToTick(99.97, 0.05)).toBe(99.95);
  });

  it('rejects invalid input', () => {
    expect(() => roundToTick(Number.NaN, 0.05)).toThrow(TypeError);
    expect(() => roundToTick(100, 0)).toThrow(TypeError);
  });
});
