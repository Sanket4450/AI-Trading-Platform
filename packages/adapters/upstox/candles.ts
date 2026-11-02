import type { UpstoxCandle, UpstoxCandleResponse } from './client.js';

export class UpstoxContractError extends Error {
  constructor(
    message: string,
    readonly payload: unknown = null,
  ) {
    super(message);
    this.name = 'UpstoxContractError';
  }
}

/** Envelope validation is separate from row validation. An empty month is valid. */
export function parseCandleEnvelope(response: unknown): UpstoxCandleResponse {
  if (!response || typeof response !== 'object') {
    throw new UpstoxContractError('Candle response is not an object', response);
  }
  const candidate = response as { status?: unknown; data?: unknown };
  if (candidate.status !== 'success') {
    throw new UpstoxContractError('Candle response status is not success', response);
  }
  if (!candidate.data || typeof candidate.data !== 'object') {
    throw new UpstoxContractError('Candle response data is missing', response);
  }
  const candles = (candidate.data as { candles?: unknown }).candles;
  if (!Array.isArray(candles)) {
    throw new UpstoxContractError('Candle response data.candles is not an array', response);
  }
  for (const candle of candles) {
    if (!Array.isArray(candle) || candle.length < 6) {
      throw new UpstoxContractError('Candle tuple has fewer than six values', candle);
    }
  }
  return response as UpstoxCandleResponse;
}

export function candleTuples(response: UpstoxCandleResponse): UpstoxCandle[] {
  return response.data.candles;
}
