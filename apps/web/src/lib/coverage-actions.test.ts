import { describe, expect, it } from 'vitest';
import { coverageFetchCopy, type CoverageSignal } from './coverage-actions';

const base: CoverageSignal = {
  symbol: 'INFY',
  fetchStatus: 'not_requested',
  dataStatus: 'pending',
  lastSuccessAt: null,
  targetFrom: '2024-01-01',
  targetTo: '2024-12-31',
  expectedDays: null,
  completeDays: null,
  partialDays: null,
  missingDays: null,
  activeJobId: null,
};

describe('coverageFetchCopy', () => {
  it('offers a full history fetch when nothing was fetched yet', () => {
    const copy = coverageFetchCopy(base);

    expect(copy?.label).toBe('Fetch full history');
    expect(copy?.title).toContain('INFY');
    expect(copy?.description).toContain('2024-01-01 → 2024-12-31');
    expect(copy?.description).toContain('never been fetched');
  });

  it('asks to retry the full fetch after a failed first attempt', () => {
    const copy = coverageFetchCopy({ ...base, fetchStatus: 'failed' });

    expect(copy?.label).toBe('Retry full fetch');
    expect(copy?.title).toContain('Retry');
  });

  it('labels an incomplete instrument as a missing-month refresh with counts', () => {
    const copy = coverageFetchCopy({
      ...base,
      fetchStatus: 'fetched',
      dataStatus: 'partial_mismatch',
      lastSuccessAt: '2024-06-01T10:00:00Z',
      expectedDays: 200,
      completeDays: 150,
      partialDays: 10,
      missingDays: 40,
    });

    expect(copy?.label).toBe('Refresh missing months');
    expect(copy?.tooltip).toContain('40 missing');
    expect(copy?.description).toContain('40 missing and 10 partial days out of 200');
  });

  it('groups stale coverage without gaps into a recheck', () => {
    const copy = coverageFetchCopy({
      ...base,
      fetchStatus: 'stale',
      dataStatus: 'complete',
      lastSuccessAt: '2024-06-01T10:00:00Z',
      expectedDays: 200,
      completeDays: 200,
    });

    expect(copy?.label).toBe('Refresh stale coverage');
    expect(copy?.description).toContain('marked stale');
  });

  it('offers no fetch when coverage is complete', () => {
    expect(
      coverageFetchCopy({
        ...base,
        fetchStatus: 'fetched',
        dataStatus: 'complete',
        lastSuccessAt: '2024-06-01T10:00:00Z',
        expectedDays: 200,
        completeDays: 200,
      }),
    ).toBeNull();
  });

  it('offers no fetch while a fetch is active or for a non-applicable instrument', () => {
    expect(
      coverageFetchCopy({ ...base, activeJobId: 'job-1', fetchStatus: 'fetching' }),
    ).toBeNull();
    expect(coverageFetchCopy({ ...base, dataStatus: 'not_applicable' })).toBeNull();
  });

  it('still offers a fetch when the projection claims a run that no longer exists', () => {
    const copy = coverageFetchCopy({ ...base, fetchStatus: 'queued', activeJobId: null });

    expect(copy?.label).toBe('Fetch full history');
  });
});
