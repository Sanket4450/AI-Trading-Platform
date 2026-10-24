/**
 * Upstox order timestamps are returned without an offset, for example
 * `2023-10-19 09:23:23`. They are IST wall-clock times. Parsing them as UTC
 * shifts every event by 5 hours 30 minutes and breaks session attribution.
 */
export function parseUpstoxTimestamp(value: string): Date {
  const trimmed = value.trim();
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
  const withOffset = hasOffset ? normalized : `${normalized}+05:30`;
  const parsed = new Date(withOffset);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid Upstox timestamp: ${value}`);
  }
  return parsed;
}
