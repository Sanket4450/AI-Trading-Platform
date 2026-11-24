const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;

export const MINUTES_PER_DAY = 24 * 60;

export interface IstClock {
  readonly date: string;
  /** `HH:MM` in IST. */
  readonly time: string;
  readonly minutes: number;
}

/** IST has no daylight saving, so a fixed offset is deterministic across every run. */
export function istClock(instant: Date): IstClock {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  const iso = shifted.toISOString();
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    minutes,
  };
}

export function istDate(instant: Date): string {
  return istClock(instant).date;
}

export function istTime(instant: Date): string {
  return istClock(instant).time;
}

export function clockToMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Invalid IST clock value: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToClock(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** Builds the UTC instant for an IST wall-clock time on a business date. */
export function istInstant(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid IST date: ${date}`);
  const minutes = clockToMinutes(time);
  return new Date(
    new Date(`${date}T00:00:00.000Z`).getTime() + minutes * MINUTE_MS - IST_OFFSET_MS,
  );
}

/** The five-minute slot that contains an instant, as an IST `HH:MM` string. */
export function fiveMinuteSlot(instant: Date): string {
  return minutesToClock(Math.floor(istClock(instant).minutes / 5) * 5);
}

export function fiveMinuteSlotStart(instant: Date): Date {
  const clock = istClock(instant);
  return istInstant(clock.date, minutesToClock(Math.floor(clock.minutes / 5) * 5));
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

export function isNormalSession(open: Date, close: Date): boolean {
  const openClock = istClock(open);
  const closeClock = istClock(close);
  return (
    openClock.time === '09:15' &&
    closeClock.time === '15:30' &&
    openClock.date === closeClock.date
  );
}
