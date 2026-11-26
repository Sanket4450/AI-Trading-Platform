import { nseHolidays, nseSpecialSessions } from './nse.js';

const IST_OFFSET = '+05:30';

export interface TradingCalendarFixtureRow {
  exchangeId: string;
  sourceProviderId: string;
  tradingDate: string;
  isTradingDay: boolean;
  sessionOpen: Date | null;
  sessionClose: Date | null;
  sessionBreaks: { start: string; end: string }[];
  description: string | null;
}

function istInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}${IST_OFFSET}`);
}

/**
 * A date is already an IST business date, so the weekday must be read from UTC
 * midnight; reading it as IST would shift Mondays into the weekend.
 */
export function buildTradingCalendarFixtureRows(input: {
  exchangeId: string;
  providerId: string;
  years: readonly number[];
}): TradingCalendarFixtureRow[] {
  const rows: TradingCalendarFixtureRow[] = [];
  for (const year of input.years) {
    for (let month = 0; month < 12; month += 1) {
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const special = nseSpecialSessions[date];
        const holiday = nseHolidays[date];
        const isTradingDay = Boolean(special) || (weekday >= 1 && weekday <= 5 && !holiday);
        const open = special?.open ?? '09:15:00';
        const close = special?.close ?? '15:30:00';
        rows.push({
          exchangeId: input.exchangeId,
          sourceProviderId: input.providerId,
          tradingDate: date,
          isTradingDay,
          sessionOpen: isTradingDay ? istInstant(date, open) : null,
          sessionClose: isTradingDay ? istInstant(date, close) : null,
          sessionBreaks: isTradingDay
            ? (special?.breaks ?? []).map((window) => ({
                start: istInstant(date, window.start).toISOString(),
                end: istInstant(date, window.end).toISOString(),
              }))
            : [],
          description: special?.description ?? holiday ?? (isTradingDay ? null : 'Weekend'),
        });
      }
    }
  }
  return rows;
}
