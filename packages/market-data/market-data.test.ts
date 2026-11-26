import { describe, expect, it } from 'vitest';
import {
  buildSessionWindow,
  computeCoverageVerdict,
  dedupeCandles,
  displayStatus,
  expectedMinutes,
  fetchStatusFromRun,
  gapRuns,
  isWithinSession,
  monthChunks,
  normalizeCandle,
  parseCandleTimestamp,
  issueDedupeKey,
  targetWindow,
} from './index.js';
import type { NormalizedCandle, SessionWindow } from './types.js';

const session: SessionWindow = {
  exchangeId: 'exchange',
  exchangeCode: 'NSE',
  tradingDate: '2026-09-01',
  open: new Date('2026-09-01T03:45:00.000Z'),
  close: new Date('2026-09-01T10:00:00.000Z'),
  breaks: [],
  expectedMinutes: 375,
  isSpecial: false,
};

const context = {
  instrumentId: 'instrument',
  sourceProviderId: 'provider',
  rawPayloadId: 'raw',
  session,
  isFinal: true,
};

describe('time', () => {
  it('parses an explicit IST offset', () => {
    expect(parseCandleTimestamp('2026-09-01T09:15:00+05:30').toISOString()).toBe(
      '2026-09-01T03:45:00.000Z',
    );
  });

  it('treats a missing offset as IST, never UTC', () => {
    expect(parseCandleTimestamp('2026-09-01T09:15:00').toISOString()).toBe(
      '2026-09-01T03:45:00.000Z',
    );
  });

  it('rejects a non-minute timestamp', () => {
    expect(() => parseCandleTimestamp('2026-09-01T09:15:30+05:30')).toThrow(/minute aligned/);
  });
});

describe('normalization', () => {
  it('converts a tuple to a canonical row', () => {
    const result = normalizeCandle(
      ['2026-09-01T09:15:00+05:30', 100, 101, 99, 100.5, 1000, 0],
      context,
    );
    expect(result).toMatchObject({
      ok: true,
      row: { tradingDate: '2026-09-01', open: '100', isFinal: true },
    });
  });

  it('rejects a row outside the reviewed session', () => {
    const result = normalizeCandle(
      ['2026-09-01T09:14:00+05:30', 100, 101, 99, 100.5, 1000, 0],
      context,
    );
    expect(result).toMatchObject({ ok: false, reason: 'outside_session' });
  });

  it('rejects invalid OHLC bounds', () => {
    const result = normalizeCandle(
      ['2026-09-01T09:15:00+05:30', 100, 99, 98, 100.5, 1000, 0],
      context,
    );
    expect(result).toMatchObject({ ok: false, reason: 'invalid_ohlc' });
  });

  it('sorts and deduplicates identical timestamps', () => {
    const a = normalizeCandle(['2026-09-01T09:16:00+05:30', 100, 101, 99, 100, 10, 0], context);
    const b = normalizeCandle(['2026-09-01T09:15:00+05:30', 100, 101, 99, 100, 10, 0], context);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const result = dedupeCandles([a.row, b.row]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.candleStart.toISOString()).toBe('2026-09-01T03:45:00.000Z');
    expect(result.duplicates).toHaveLength(0);
  });
});

describe('chunking', () => {
  it('uses one calendar month per chunk', () => {
    const chunks = monthChunks('2022-01-01', '2022-03-15');
    expect(chunks).toEqual([
      { index: 0, from: '2022-01-01', to: '2022-01-31' },
      { index: 1, from: '2022-02-01', to: '2022-02-28' },
      { index: 2, from: '2022-03-01', to: '2022-03-15' },
    ]);
  });

  it('caps the target window at listing and delisting dates', () => {
    expect(
      targetWindow({
        listedOn: '2024-05-01',
        delistedOn: '2025-06-01',
        lastCompletedSession: '2026-10-23',
      }),
    ).toEqual({ from: '2024-05-01', to: '2025-06-01' });
  });
});

describe('gaps', () => {
  it('collapses consecutive missing minutes into runs', () => {
    const runs = gapRuns([
      new Date('2026-09-01T03:45:00.000Z'),
      new Date('2026-09-01T03:46:00.000Z'),
      new Date('2026-09-01T05:00:00.000Z'),
    ]);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.minutes).toBe(2);
    expect(runs[1]!.minutes).toBe(1);
  });
});

describe('coverage', () => {
  it('marks a day partial when expected minutes are missing', () => {
    const verdict = computeCoverageVerdict({
      session,
      observed: [new Date('2026-09-01T03:45:00.000Z')],
    });
    expect(verdict.status).toBe('partial');
    expect(verdict.expectedBars).toBe(375);
    expect(verdict.missingBarCount).toBe(374);
  });

  it('marks a day complete only when every expected minute is present', () => {
    const observed = Array.from({ length: 375 }, (_, index) => {
      const value = new Date('2026-09-01T03:45:00.000Z');
      value.setUTCMinutes(value.getUTCMinutes() + index);
      return value;
    });
    const verdict = computeCoverageVerdict({ session, observed });
    expect(verdict.status).toBe('complete');
    expect(verdict.missingBarCount).toBe(0);
  });
});

describe('session windows with breaks', () => {
  const drSession = buildSessionWindow({
    exchangeId: 'exchange',
    exchangeCode: 'NSE',
    tradingDate: '2024-05-18',
    isTradingDay: true,
    sessionOpen: new Date('2024-05-18T03:45:00.000Z'),
    sessionClose: new Date('2024-05-18T07:00:00.000Z'),
    sessionBreaks: [
      { start: '2024-05-18T04:30:00.000Z', end: '2024-05-18T06:00:00.000Z' },
    ],
  });

  it('subtracts the break from expected minutes', () => {
    expect(drSession).not.toBeNull();
    expect(drSession!.expectedMinutes).toBe(105);
    expect(drSession!.isSpecial).toBe(true);
    expect(expectedMinutes(drSession!)).toHaveLength(105);
  });

  it('excludes break minutes but keeps the minutes on either edge', () => {
    const minutes = expectedMinutes(drSession!).map((value) => value.toISOString());
    expect(minutes).toContain('2024-05-18T04:29:00.000Z');
    expect(minutes).not.toContain('2024-05-18T04:30:00.000Z');
    expect(minutes).not.toContain('2024-05-18T05:59:00.000Z');
    expect(minutes).toContain('2024-05-18T06:00:00.000Z');
    expect(minutes.at(-1)).toBe('2024-05-18T06:59:00.000Z');
  });

  it('rejects candles inside the break as outside the session', () => {
    expect(isWithinSession(new Date('2024-05-18T03:45:00.000Z'), drSession!)).toBe(true);
    expect(isWithinSession(new Date('2024-05-18T04:30:00.000Z'), drSession!)).toBe(false);
    expect(isWithinSession(new Date('2024-05-18T06:00:00.000Z'), drSession!)).toBe(true);
  });

  it('fails closed on a break outside the session', () => {
    expect(() =>
      buildSessionWindow({
        exchangeId: 'exchange',
        tradingDate: '2024-05-18',
        isTradingDay: true,
        sessionOpen: new Date('2024-05-18T03:45:00.000Z'),
        sessionClose: new Date('2024-05-18T07:00:00.000Z'),
        sessionBreaks: [
          { start: '2024-05-18T04:00:00.000Z', end: '2024-05-18T07:30:00.000Z' },
        ],
      }),
    ).toThrow(/inside the session/);
  });
});

describe('catalog and quality', () => {
  it('never shows a successful fetch as complete without coverage', () => {
    expect(
      displayStatus({
        fetchStatus: 'fetched',
        dataStatus: 'pending',
        lastSuccessAt: new Date('2026-10-01T10:00:00Z'),
        computedAt: new Date('2026-10-01T09:00:00Z'),
      }),
    ).toBe('Verifying');
  });

  it('shows failed before any data status', () => {
    expect(
      displayStatus({
        fetchStatus: 'failed',
        dataStatus: 'complete',
        lastSuccessAt: null,
        computedAt: null,
      }),
    ).toBe('Failed');
  });

  it('derives fetch status from the latest backfill run, never from a closed run still running', () => {
    expect(fetchStatusFromRun(null)).toBe('not_requested');
    expect(fetchStatusFromRun({ status: 'queued' })).toBe('queued');
    expect(fetchStatusFromRun({ status: 'running' })).toBe('fetching');
    expect(fetchStatusFromRun({ status: 'succeeded' })).toBe('fetched');
    expect(fetchStatusFromRun({ status: 'partially_failed' })).toBe('partial');
    expect(fetchStatusFromRun({ status: 'failed' })).toBe('failed');
    expect(fetchStatusFromRun({ status: 'cancelled' })).toBe('cancelled');
  });

  it('builds a stable dedupe key', () => {
    const input = {
      source: 'validation',
      kind: 'missing_bar',
      providerId: 'p',
      instrumentId: 'i',
      scope: { ruleId: 'DQ-001', tradingDate: '2026-09-01' },
    };
    expect(issueDedupeKey(input)).toBe(
      issueDedupeKey({ ...input, scope: { tradingDate: '2026-09-01', ruleId: 'DQ-001' } }),
    );
    expect(issueDedupeKey(input)).not.toBe(
      issueDedupeKey({ ...input, scope: { ...input.scope, ruleId: 'DQ-002' } }),
    );
  });
});

describe('normalized candle type', () => {
  it('keeps decimal values as strings', () => {
    const row: NormalizedCandle = {
      instrumentId: 'i',
      candleStart: new Date(),
      tradingDate: '2026-09-01',
      open: '1.0000',
      high: '1.0000',
      low: '1.0000',
      close: '1.0000',
      volume: '0',
      sourceProviderId: 'p',
      rawPayloadId: 'raw',
      isFinal: false,
    };
    expect(row.volume).toBe('0');
  });
});
