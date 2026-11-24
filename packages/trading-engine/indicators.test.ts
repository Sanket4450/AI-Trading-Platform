import { describe, expect, it } from 'vitest';
import type { Bar } from '@ai-trading/domain';
import {
  ceilToTick,
  cumulativeVwap,
  emaAt,
  emaSeries,
  floorToTick,
  median,
  nearestTick,
  rollupFiveMinuteBars,
} from './index.js';

const at = (time: string): Date => new Date(`2026-01-05T${time}:00.000Z`);
const bar = (time: string, value: number, volume = 100): Bar => ({
  instrument: 'AAA',
  timeframe: '1m',
  timestamp: at(time),
  open: value,
  high: value + 0.5,
  low: value - 0.5,
  close: value,
  volume,
});

describe('five-minute rollup', () => {
  it('aggregates five complete minutes', () => {
    const bars = Array.from({ length: 5 }, (_, index) =>
      bar(`03:${String(45 + index).padStart(2, '0')}`, 100 + index, 100),
    );
    const [rolled] = rollupFiveMinuteBars(bars);
    expect(rolled?.complete).toBe(true);
    expect(rolled?.open).toBe(100);
    expect(rolled?.close).toBe(104);
    expect(rolled?.high).toBe(104.5);
    expect(rolled?.low).toBe(99.5);
    expect(rolled?.volume).toBe(500);
  });

  it('marks a partially covered group incomplete', () => {
    const bars = Array.from({ length: 4 }, (_, index) =>
      bar(`03:${String(45 + index).padStart(2, '0')}`, 100, 100),
    );
    const [rolled] = rollupFiveMinuteBars(bars);
    expect(rolled?.complete).toBe(false);
    expect(rolled?.minuteCount).toBe(4);
  });
});

describe('cumulative vwap', () => {
  it('weights the typical price by volume', () => {
    const bars = [bar('03:45', 100, 300), bar('03:46', 102, 100)];
    const result = cumulativeVwap(bars, at('03:45'), at('03:46'));
    expect(result.vwap).toBeCloseTo(100.5, 10);
  });

  it('returns null when volume is zero', () => {
    const result = cumulativeVwap([bar('03:45', 100, 0)], at('03:45'), at('03:45'));
    expect(result.vwap).toBeNull();
  });
});

describe('ema', () => {
  it('seeds with the simple average then recurses', () => {
    const series = emaSeries([1, 2, 3, 4, 5], 3);
    expect(series).toEqual([null, null, 2, 3, 4]);
  });

  it('returns no value before the period is filled', () => {
    expect(emaAt([1, 2], 3)).toBeNull();
  });
});

describe('median', () => {
  it('handles odd and even sample counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('tick rounding', () => {
  it('rounds direction-aware', () => {
    expect(ceilToTick(101.01, 0.05)).toBe(101.05);
    expect(floorToTick(101.04, 0.05)).toBe(101);
    expect(nearestTick(101.03, 0.05)).toBe(101.05);
  });

  it('rejects invalid ticks', () => {
    expect(() => ceilToTick(100, 0)).toThrow(/tickSize/);
  });
});
