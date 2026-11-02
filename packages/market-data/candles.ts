import type {
  NormalizationContext,
  NormalizationResult,
  NormalizedCandle,
  QualityReason,
  RawCandle,
} from './types.js';
import { isWithinSession } from './sessions.js';
import { istTradingDate, parseCandleTimestamp } from './time.js';

function reject(reason: QualityReason, error: string): NormalizationResult {
  return { ok: false, reason, error };
}

function decimal(value: number): string {
  return Number.isFinite(value) ? String(value) : '';
}

/**
 * Converts one provider tuple into a canonical candle. Every rejection carries
 * a reason so the caller can create evidence instead of dropping the row.
 */
export function normalizeCandle(
  candle: RawCandle,
  context: NormalizationContext,
): NormalizationResult {
  if (!Array.isArray(candle) || candle.length < 6) {
    return reject('invalid_number', 'Candle tuple has fewer than six values');
  }
  const [timestamp, open, high, low, close, volume] = candle;

  let candleStart: Date;
  try {
    candleStart = parseCandleTimestamp(timestamp);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid timestamp';
    return reject(
      message.includes('minute aligned') ? 'non_minute_timestamp' : 'invalid_timestamp',
      message,
    );
  }

  for (const [field, value] of Object.entries({ open, high, low, close, volume })) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return reject('invalid_number', `Candle ${timestamp} has invalid ${field}`);
    }
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    return reject('invalid_price', `Candle ${timestamp} has a non-positive price`);
  }
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    return reject('invalid_ohlc', `Candle ${timestamp} violates OHLC bounds`);
  }
  if (volume < 0) {
    return reject('negative_volume', `Candle ${timestamp} has negative volume`);
  }

  const tradingDate = istTradingDate(candleStart);
  if (context.session) {
    if (context.session.tradingDate !== tradingDate) {
      return reject(
        'non_trading_day',
        `Candle ${timestamp} belongs to ${tradingDate}, not the session date`,
      );
    }
    if (!isWithinSession(candleStart, context.session)) {
      return reject(
        'outside_session',
        `Candle ${timestamp} is outside the reviewed session window`,
      );
    }
  }

  return {
    ok: true,
    row: {
      instrumentId: context.instrumentId,
      candleStart,
      tradingDate,
      open: decimal(open),
      high: decimal(high),
      low: decimal(low),
      close: decimal(close),
      volume: decimal(volume),
      sourceProviderId: context.sourceProviderId,
      ingestionRunId: context.ingestionRunId,
      rawPayloadId: context.rawPayloadId,
      isFinal: context.isFinal,
    },
  };
}

export interface CandleValidation {
  ok: boolean;
  reason?: QualityReason;
  error?: string;
}

export function validateNormalizedCandle(
  row: NormalizedCandle,
  tickSize?: number | null,
): CandleValidation {
  const open = Number(row.open);
  const high = Number(row.high);
  const low = Number(row.low);
  const close = Number(row.close);
  const volume = Number(row.volume);
  if (![open, high, low, close, volume].every(Number.isFinite)) {
    return { ok: false, reason: 'invalid_number', error: 'Candle has non-finite values' };
  }
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    return { ok: false, reason: 'invalid_price', error: 'Candle has a non-positive price' };
  }
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    return { ok: false, reason: 'invalid_ohlc', error: 'Candle violates OHLC bounds' };
  }
  if (volume < 0) {
    return { ok: false, reason: 'negative_volume', error: 'Candle has negative volume' };
  }
  if (tickSize && tickSize > 0) {
    const tick = tickSize;
    for (const value of [open, high, low, close]) {
      const remainder = Math.abs(Math.round(value / tick) * tick - value);
      if (remainder > 1e-6) {
        return {
          ok: false,
          reason: 'invalid_price',
          error: `Price ${value} is not aligned to tick ${tick}`,
        };
      }
    }
  }
  return { ok: true };
}

export interface DedupeResult {
  rows: NormalizedCandle[];
  duplicates: { timestamp: Date; kept: NormalizedCandle; dropped: NormalizedCandle }[];
}

/** Sorting is mandatory: provider array order is not a contract. */
export function dedupeCandles(rows: readonly NormalizedCandle[]): DedupeResult {
  const sorted = [...rows].sort((a, b) => a.candleStart.getTime() - b.candleStart.getTime());
  const kept = new Map<number, NormalizedCandle>();
  const duplicates: DedupeResult['duplicates'] = [];
  for (const row of sorted) {
    const key = row.candleStart.getTime();
    const existing = kept.get(key);
    if (!existing) {
      kept.set(key, row);
      continue;
    }
    const identical =
      existing.open === row.open &&
      existing.high === row.high &&
      existing.low === row.low &&
      existing.close === row.close &&
      existing.volume === row.volume;
    if (!identical) {
      duplicates.push({ timestamp: row.candleStart, kept: existing, dropped: row });
    }
  }
  return { rows: [...kept.values()], duplicates };
}

export function candleEquals(a: NormalizedCandle, b: NormalizedCandle): boolean {
  return (
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume
  );
}
