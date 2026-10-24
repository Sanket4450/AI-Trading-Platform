/**
 * Round a price to the nearest valid tick. Indian cash equities commonly use
 * a ₹0.05 tick, but the tick is stored per instrument and may change.
 */
export function roundToTick(price: number, tickSize: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) {
    throw new TypeError('price and tickSize must be finite and tickSize must be positive');
  }
  const ticks = Math.round(price / tickSize);
  return Number((ticks * tickSize).toFixed(10));
}
