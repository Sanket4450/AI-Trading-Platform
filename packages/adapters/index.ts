/**
 * @ai-trading/adapters
 * Public entry point. Keep framework-specific code out of this package.
 */
export {
  UpstoxApiError,
  UpstoxClient,
  classifyUpstoxError,
  parseUpstoxErrorEnvelope,
  type CandleRequest,
  type UpstoxCandle,
  type UpstoxCandleResponse,
  type UpstoxClientOptions,
  type UpstoxErrorClass,
  type UpstoxErrorClassification,
  type UpstoxErrorDetail,
  type UpstoxErrorEnvelope,
  type UpstoxHoliday,
  type UpstoxInstrument,
  type UpstoxMarketTiming,
} from './upstox/client.js';
export { UpstoxContractError, candleTuples, parseCandleEnvelope } from './upstox/candles.js';
export { mapUpstoxOrderStatus, type InternalOrderStatus } from './upstox/order-status.js';
export { parseUpstoxTimestamp } from './upstox/timestamp.js';
export {
  InMemoryRateLimiter,
  type RateLimitConfig,
  type RateLimitState,
  type RateLimiter,
} from './rate-limit.js';
