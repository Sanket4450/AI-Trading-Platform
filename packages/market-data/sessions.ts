import type { CalendarSessionRow, GapRun, SessionBreak, SessionWindow } from './types.js';
import { addMinutes } from './time.js';

const MINUTE_MS = 60_000;

/** Break windows are reviewed calendar data, so a malformed one fails closed. */
function resolveBreaks(
  rows: CalendarSessionRow['sessionBreaks'],
  open: Date,
  close: Date,
): SessionBreak[] {
  const breaks = (rows ?? [])
    .map((value) => {
      const start = value.start instanceof Date ? value.start : new Date(value.start);
      const end = value.end instanceof Date ? value.end : new Date(value.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Session break has an invalid timestamp');
      }
      if (start < open || end > close || start >= end) {
        throw new Error('Session break must sit inside the session and end after it starts');
      }
      if ((end.getTime() - start.getTime()) % MINUTE_MS !== 0) {
        throw new Error('Session break must be minute aligned');
      }
      return { start, end };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (let index = 1; index < breaks.length; index += 1) {
    if (breaks[index]!.start < breaks[index - 1]!.end) {
      throw new Error('Session breaks must not overlap');
    }
  }
  return breaks;
}

function inBreak(instant: Date, breaks: readonly SessionBreak[]): boolean {
  return breaks.some((value) => instant >= value.start && instant < value.end);
}

/**
 * A reviewed calendar row becomes a session window. Expected bars are the
 * exact session minutes, so a 60-minute Muhurat session expects 60 bars and an
 * intraday break is excluded from the count.
 */
export function buildSessionWindow(row: CalendarSessionRow): SessionWindow | null {
  if (!row.isTradingDay || !row.sessionOpen || !row.sessionClose) return null;
  const breaks = resolveBreaks(row.sessionBreaks, row.sessionOpen, row.sessionClose);
  const outerMinutes = Math.round(
    (row.sessionClose.getTime() - row.sessionOpen.getTime()) / MINUTE_MS,
  );
  const breakMinutes = breaks.reduce(
    (total, value) => total + (value.end.getTime() - value.start.getTime()) / MINUTE_MS,
    0,
  );
  const expectedMinutes = outerMinutes - breakMinutes;
  if (expectedMinutes <= 0) return null;
  const isSpecial =
    expectedMinutes !== 375 ||
    row.sessionOpen.getUTCHours() !== 3 ||
    row.sessionOpen.getUTCMinutes() !== 45;
  return {
    exchangeId: row.exchangeId,
    exchangeCode: row.exchangeCode ?? 'NSE',
    tradingDate: row.tradingDate,
    open: row.sessionOpen,
    close: row.sessionClose,
    breaks,
    expectedMinutes,
    isSpecial,
  };
}

export function expectedMinutes(session: SessionWindow): Date[] {
  const minutes: Date[] = [];
  for (let cursor = session.open; cursor < session.close; cursor = addMinutes(cursor, 1)) {
    if (!inBreak(cursor, session.breaks)) minutes.push(cursor);
  }
  return minutes;
}

export function isWithinSession(instant: Date, session: SessionWindow): boolean {
  if (instant < session.open || instant >= session.close) return false;
  return !inBreak(instant, session.breaks);
}

export function diffMinutes(expected: readonly Date[], observed: readonly Date[]): Date[] {
  const seen = new Set(observed.map((value) => value.getTime()));
  return expected.filter((value) => !seen.has(value.getTime()));
}

/** Consecutive missing minutes collapse into runs; a run is not a bar count. */
export function gapRuns(missing: readonly Date[]): GapRun[] {
  if (missing.length === 0) return [];
  const sorted = [...missing].sort((a, b) => a.getTime() - b.getTime());
  const runs: GapRun[] = [];
  let start = sorted[0]!;
  let previous = sorted[0]!;
  for (const current of sorted.slice(1)) {
    if (current.getTime() - previous.getTime() === MINUTE_MS) {
      previous = current;
      continue;
    }
    runs.push({
      start,
      end: previous,
      minutes: Math.round((previous.getTime() - start.getTime()) / MINUTE_MS) + 1,
    });
    start = current;
    previous = current;
  }
  runs.push({
    start,
    end: previous,
    minutes: Math.round((previous.getTime() - start.getTime()) / MINUTE_MS) + 1,
  });
  return runs;
}

export function boundaryFindings(
  expected: readonly Date[],
  observed: readonly Date[],
): { missingOpen: boolean; missingClose: boolean } {
  const seen = new Set(observed.map((value) => value.getTime()));
  return {
    missingOpen: expected.length > 0 ? !seen.has(expected[0]!.getTime()) : false,
    missingClose: expected.length > 0 ? !seen.has(expected[expected.length - 1]!.getTime()) : false,
  };
}
