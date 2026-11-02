import { describe, expect, it } from 'vitest';
import {
  compareDailyToMinute,
  computeCoverageVerdict,
  dedupeCandles,
  displayStatus,
  gapRuns,
  monthChunks,
  normalizeCandle,
  parseCandleTimestamp,
  qualityDedupeKey,
  targetWindow,
} from './index.js';
import type { NormalizedCandle, SessionWindow } from './types.js';

const session: SessionWindow = {
  exchangeId: 'exchange',
  exchangeCode: 'NSE',
  tradingDate: '2026-09-01',
  open: new Date('2026-09-01T03:45:00.000Z'),
  close: new Date('2026-09-01T10:00:00.000Z'),
  expectedMinutes: 375,
  isSpecial: false,
};

const context = {
  instrumentId: 'instrument',
  sourceProviderId: 'provider',
  ingestionRunId: 'run',
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

describe('daily oracle', () => {
  it('reconciles missing minutes when volume matches', () => {
    const comparison = compareDailyToMinute({
      daily: { open: '100', high: '102', low: '99', close: '101', volume: '1000' },
      minute: { open: '100', high: '102', low: '99', close: '101', volume: '1000', bars: 372 },
      tickSize: 0.05,
      volumeTolerancePct: 0.005,
    });
    expect(comparison.status).toBe('matched');
    expect(comparison.ohlcMatch).toBe(true);
    expect(comparison.volumeMatch).toBe(true);
  });

  it('marks a volume shortfall as a mismatch', () => {
    const comparison = compareDailyToMinute({
      daily: { open: '100', high: '102', low: '99', close: '101', volume: '1000' },
      minute: { open: '100', high: '102', low: '99', close: '101', volume: '900', bars: 372 },
      tickSize: 0.05,
      volumeTolerancePct: 0.005,
    });
    expect(comparison.status).toBe('volume_mismatch');
  });

  it('keeps strict status partial while validation reconciles it', () => {
    const verdict = computeCoverageVerdict({
      session,
      observed: [new Date('2026-09-01T03:45:00.000Z')],
      daily: { open: '100', high: '102', low: '99', close: '101', volume: '1000' },
      minute: { open: '100', high: '102', low: '99', close: '101', volume: '1000', bars: 1 },
      tickSize: 0.05,
      volumeTolerancePct: 0.005,
      hasCriticalIssue: false,
    });
    expect(verdict.status).toBe('partial');
    expect(verdict.validationStatus).toBe('volume_reconciled');
    expect(verdict.expectedBars).toBe(375);
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

  it('builds a stable dedupe key', () => {
    const input = {
      ruleId: 'DQ-001',
      providerId: 'p',
      instrumentId: 'i',
      tradingDate: '2026-09-01',
      windowStart: new Date('2026-09-01T03:45:00Z'),
      windowEnd: new Date('2026-09-01T03:46:00Z'),
    };
    expect(qualityDedupeKey(input)).toBe(qualityDedupeKey({ ...input }));
    expect(qualityDedupeKey(input)).not.toBe(qualityDedupeKey({ ...input, ruleId: 'DQ-002' }));
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
      ingestionRunId: 'r',
      rawPayloadId: 'raw',
      isFinal: false,
    };
    expect(row.volume).toBe('0');
  });
});
