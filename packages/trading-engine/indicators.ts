import type { Bar } from '@ai-trading/domain';
import { addMinutes, fiveMinuteSlotStart, istClock } from './time.js';

export interface FiveMinuteBar extends Bar {
  readonly timeframe: '5m';
  /** True only when all five 1-minute bars are present and contiguous. */
  readonly complete: boolean;
  readonly minuteCount: number;
}

function isMinuteAligned(instant: Date): boolean {
  return instant.getUTCSeconds() === 0 && instant.getUTCMilliseconds() === 0;
}

/**
 * Rolls 1-minute bars into IST five-minute bars. A partial group is returned as incomplete so
 * callers can skip the day instead of filling a bar.
 */
export function rollupFiveMinuteBars(bars: readonly Bar[]): FiveMinuteBar[] {
  const groups = new Map<string, Bar[]>();

  for (const bar of bars) {
    if (bar.timeframe !== '1m' || !isMinuteAligned(bar.timestamp)) continue;
    const start = fiveMinuteSlotStart(bar.timestamp);
    const key = start.toISOString();
    const group = groups.get(key);
    if (group) group.push(bar);
    else groups.set(key, [bar]);
  }

  const rolled: FiveMinuteBar[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const start = new Date(key);
    const expected = new Set(
      Array.from({ length: 5 }, (_, index) => addMinutes(start, index).getTime()),
    );
    const complete =
      sorted.length === 5 &&
      sorted.every((bar) => expected.has(bar.timestamp.getTime())) &&
      new Set(sorted.map((bar) => bar.timestamp.getTime())).size === 5;

    rolled.push({
      instrument: sorted[0]!.instrument,
      timeframe: '5m',
      timestamp: start,
      open: sorted[0]!.open,
      high: Math.max(...sorted.map((bar) => bar.high)),
      low: Math.min(...sorted.map((bar) => bar.low)),
      close: sorted[sorted.length - 1]!.close,
      volume: sorted.reduce((total, bar) => total + bar.volume, 0),
      complete,
      minuteCount: sorted.length,
    });
  }

  return rolled.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export interface VwapResult {
  readonly vwap: number | null;
  readonly volume: number;
}

/** Cumulative VWAP from the session open through the decision bar inclusive. */
export function cumulativeVwap(
  bars: readonly Bar[],
  sessionOpen: Date,
  through: Date,
): VwapResult {
  let priceVolume = 0;
  let volume = 0;
  for (const bar of bars) {
    if (bar.timeframe !== '1m') continue;
    if (bar.timestamp < sessionOpen || bar.timestamp > through) continue;
    const typical = (bar.high + bar.low + bar.close) / 3;
    priceVolume += typical * bar.volume;
    volume += bar.volume;
  }
  if (volume <= 0) return { vwap: null, volume };
  return { vwap: priceVolume / volume, volume };
}

/**
 * EMA series aligned with the input. The first `period - 1` entries are null; the seed value is
 * the simple average of the first `period` closes, then the standard recursive formula applies.
 */
export function emaSeries(values: readonly number[], period: number): (number | null)[] {
  if (period < 1) throw new Error('EMA period must be positive');
  const result: (number | null)[] = Array.from({ length: values.length }, () => null);
  if (values.length < period) return result;

  const seed =
    values.slice(0, period).reduce((total, value) => total + value, 0) / period;
  result[period - 1] = seed;
  const multiplier = 2 / (period + 1);
  let previous = seed;
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index]! - previous) * multiplier + previous;
    result[index] = previous;
  }
  return result;
}

export function emaAt(values: readonly number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series[series.length - 1] ?? null;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function tickQuantity(price: number, tickSize: number): number {
  const ticks = price / tickSize;
  // Round away binary noise before ceil/floor so 100.0000000001 does not become the next tick.
  return Math.round(ticks * 1e8) / 1e8;
}

export function ceilToTick(price: number, tickSize: number): number {
  assertTick(tickSize);
  return Number((Math.ceil(tickQuantity(price, tickSize)) * tickSize).toFixed(10));
}

export function floorToTick(price: number, tickSize: number): number {
  assertTick(tickSize);
  return Number((Math.floor(tickQuantity(price, tickSize)) * tickSize).toFixed(10));
}

export function nearestTick(price: number, tickSize: number): number {
  assertTick(tickSize);
  return Number((Math.round(tickQuantity(price, tickSize)) * tickSize).toFixed(10));
}

function assertTick(tickSize: number): void {
  if (!Number.isFinite(tickSize) || tickSize <= 0) {
    throw new Error('tickSize must be finite and positive');
  }
}

/** Proves an instant belongs to the session's IST business date. */
export function sameIstDate(instant: Date, date: string): boolean {
  return istClock(instant).date === date;
}
