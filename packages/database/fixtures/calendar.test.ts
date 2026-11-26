import { describe, expect, it } from 'vitest';
import { buildTradingCalendarFixtureRows } from './calendar.js';

const rows = buildTradingCalendarFixtureRows({
  exchangeId: 'exchange',
  providerId: 'provider',
  years: [2023, 2024, 2025],
});
const byDate = new Map(rows.map((row) => [row.tradingDate, row]));

function row(date: string) {
  const found = byDate.get(date);
  if (!found) throw new Error(`Missing calendar row ${date}`);
  return found;
}

describe('NSE calendar fixture', () => {
  it('marks the missing 2024 closures as non-trading', () => {
    for (const date of ['2024-01-22', '2024-05-20', '2024-11-20']) {
      expect(row(date).isTradingDay).toBe(false);
      expect(row(date).sessionOpen).toBeNull();
      expect(row(date).sessionClose).toBeNull();
      expect(row(date).sessionBreaks).toEqual([]);
    }
  });

  it('uses the verified Muhurat windows', () => {
    expect(row('2024-11-01').sessionOpen?.toISOString()).toBe('2024-11-01T12:30:00.000Z');
    expect(row('2024-11-01').sessionClose?.toISOString()).toBe('2024-11-01T13:30:00.000Z');
    expect(row('2025-10-21').sessionOpen?.toISOString()).toBe('2025-10-21T08:15:00.000Z');
    expect(row('2025-10-21').sessionClose?.toISOString()).toBe('2025-10-21T09:15:00.000Z');
  });

  it('adds the Sunday Muhurat session', () => {
    expect(row('2023-11-12').isTradingDay).toBe(true);
    expect(row('2023-11-12').sessionOpen?.toISOString()).toBe('2023-11-12T12:45:00.000Z');
    expect(row('2023-11-12').sessionClose?.toISOString()).toBe('2023-11-12T13:45:00.000Z');
  });

  it('records the 2024-05-18 DR session as an outer window with a break', () => {
    expect(row('2024-05-18').isTradingDay).toBe(true);
    expect(row('2024-05-18').sessionOpen?.toISOString()).toBe('2024-05-18T03:45:00.000Z');
    expect(row('2024-05-18').sessionClose?.toISOString()).toBe('2024-05-18T07:00:00.000Z');
    expect(row('2024-05-18').sessionBreaks).toEqual([
      { start: '2024-05-18T04:30:00.000Z', end: '2024-05-18T06:00:00.000Z' },
    ]);
  });

  it('keeps normal weekdays and weekends unchanged', () => {
    expect(row('2024-05-21').isTradingDay).toBe(true);
    expect(row('2024-05-21').sessionOpen?.toISOString()).toBe('2024-05-21T03:45:00.000Z');
    expect(row('2024-05-21').sessionClose?.toISOString()).toBe('2024-05-21T10:00:00.000Z');
    expect(row('2024-05-21').sessionBreaks).toEqual([]);
    expect(row('2024-05-19').isTradingDay).toBe(false);
  });
});
