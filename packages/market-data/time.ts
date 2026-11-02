const IST_OFFSET = '+05:30';
const MINUTE_MS = 60_000;

const hasOffset = (value: string): boolean => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);

/**
 * Upstox returns ISO-8601 with +05:30. A missing offset means IST, never UTC.
 * The returned instant is always UTC and must land on an exact minute.
 */
export function parseCandleTimestamp(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Invalid candle timestamp: empty value');
  const normalized = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
  const withOffset = hasOffset(normalized) ? normalized : `${normalized}${IST_OFFSET}`;
  const parsed = new Date(withOffset);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid candle timestamp: ${value}`);
  }
  if (parsed.getUTCSeconds() !== 0 || parsed.getUTCMilliseconds() !== 0) {
    throw new Error(`Candle timestamp is not minute aligned: ${value}`);
  }
  return parsed;
}

/** IST business date derived from a UTC instant. */
export function istTradingDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function istToday(now: Date = new Date()): string {
  return istTradingDate(now);
}

export function isMinuteAligned(instant: Date): boolean {
  return instant.getUTCSeconds() === 0 && instant.getUTCMilliseconds() === 0;
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function sameMinute(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}
