import type { BackfillPreview, CalendarSessionRow, MonthChunk, SessionWindow } from './types.js';
import { buildSessionWindow } from './sessions.js';
import { addDays, daysBetween, eachDate, maxDate, minDate } from './time.js';

export const HISTORY_START = '2022-01-01';

/** One calendar month per 1-minute request; partial edge months use exact dates. */
export function monthChunks(from: string, to: string): MonthChunk[] {
  if (to < from) return [];
  const chunks: MonthChunk[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  let index = 0;
  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const chunkEnd = monthEnd > end ? end : monthEnd;
    chunks.push({
      index,
      from: cursor.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    });
    index += 1;
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }
  return chunks;
}

export function targetWindow(input: {
  listedOn: string | null;
  delistedOn: string | null;
  lastCompletedSession: string;
}): { from: string; to: string } {
  const from = maxDate(HISTORY_START, input.listedOn ?? HISTORY_START);
  const to = minDate(input.lastCompletedSession, input.delistedOn ?? input.lastCompletedSession);
  return { from, to: to < from ? from : to };
}

export function lastCompletedSession(
  calendar: readonly CalendarSessionRow[],
  now: Date,
): string | null {
  const completed = calendar
    .filter((row) => {
      const session = buildSessionWindow(row);
      return session !== null && session.close <= now;
    })
    .map((row) => row.tradingDate)
    .sort();
  return completed.at(-1) ?? null;
}

export function sessionsInWindow(
  calendar: readonly CalendarSessionRow[],
  from: string,
  to: string,
): SessionWindow[] {
  return calendar
    .filter((row) => row.tradingDate >= from && row.tradingDate <= to)
    .map(buildSessionWindow)
    .filter((session): session is SessionWindow => session !== null);
}

export function selectMissingMonths(input: {
  all: readonly MonthChunk[];
  completedMonths: ReadonlySet<string>;
  failedMonths: ReadonlySet<string>;
  mode: 'missing_only' | 'force';
}): { fetch: MonthChunk[]; skipped: MonthChunk[] } {
  if (input.mode === 'force') return { fetch: [...input.all], skipped: [] };
  const fetch: MonthChunk[] = [];
  const skipped: MonthChunk[] = [];
  for (const chunk of input.all) {
    const key = `${chunk.from}:${chunk.to}`;
    if (input.completedMonths.has(key) && !input.failedMonths.has(key)) skipped.push(chunk);
    else fetch.push(chunk);
  }
  return { fetch, skipped };
}

export function monthKey(chunk: MonthChunk): string {
  return `${chunk.from}:${chunk.to}`;
}

/**
 * Dry-run estimate. Request count is month-granular because the provider
 * returns a whole month; a three-minute hole still refetches its month.
 */
export function previewBackfill(input: {
  instrumentCount: number;
  from: string;
  to: string;
  sessions: number;
  skippedMonths: number;
  averageBarsPerSession?: number;
  averagePayloadBytesPerMonth?: number;
}): BackfillPreview {
  const chunks = monthChunks(input.from, input.to);
  const requestCount = Math.max(0, chunks.length - input.skippedMonths);
  const averageBars = input.averageBarsPerSession ?? 375;
  const averageBytes = input.averagePayloadBytesPerMonth ?? 200_000;
  return {
    instrumentCount: input.instrumentCount,
    sessionCount: input.sessions,
    monthCount: chunks.length,
    requestCount: requestCount * input.instrumentCount,
    estimatedBars: input.sessions * averageBars * input.instrumentCount,
    estimatedBytes: requestCount * averageBytes * input.instrumentCount,
    skippedMonths: input.skippedMonths,
    months: chunks,
  };
}

export function validateBackfillRange(input: {
  from: string;
  to: string;
  lastCompletedSession: string;
  maxInstruments: number;
  instrumentCount: number;
  maxDays?: number;
}): string[] {
  const errors: string[] = [];
  if (input.from < HISTORY_START) errors.push(`from must be on or after ${HISTORY_START}`);
  if (input.to > input.lastCompletedSession) {
    errors.push(`to must be on or before the last completed session ${input.lastCompletedSession}`);
  }
  if (input.to < input.from) errors.push('to must be on or after from');
  if (input.instrumentCount < 1) errors.push('at least one instrument is required');
  if (input.instrumentCount > input.maxInstruments) {
    errors.push(`at most ${input.maxInstruments} instruments are allowed`);
  }
  if (input.maxDays !== undefined && daysBetween(input.from, input.to) > input.maxDays) {
    errors.push(`a single repair is limited to ${input.maxDays} days`);
  }
  return errors;
}

export function datesBetween(from: string, to: string): string[] {
  return eachDate(from, to);
}

export function nextDate(date: string): string {
  return addDays(date, 1);
}
