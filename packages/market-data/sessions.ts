import type { CalendarSessionRow, GapRun, SessionWindow } from './types.js';
import { addMinutes } from './time.js';

const MINUTE_MS = 60_000;

/**
 * A reviewed calendar row becomes a session window. Expected bars are the
 * exact session minutes, so a 60-minute Muhurat session expects 60 bars.
 */
export function buildSessionWindow(row: CalendarSessionRow): SessionWindow | null {
  if (!row.isTradingDay || !row.sessionOpen || !row.sessionClose) return null;
  const expectedMinutes = Math.round(
    (row.sessionClose.getTime() - row.sessionOpen.getTime()) / MINUTE_MS,
  );
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
    expectedMinutes,
    isSpecial,
  };
}

export function expectedMinutes(session: SessionWindow): Date[] {
  const minutes: Date[] = [];
  for (let cursor = session.open; cursor < session.close; cursor = addMinutes(cursor, 1)) {
    minutes.push(cursor);
  }
  return minutes;
}

export function isWithinSession(instant: Date, session: SessionWindow): boolean {
  return instant >= session.open && instant < session.close;
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
