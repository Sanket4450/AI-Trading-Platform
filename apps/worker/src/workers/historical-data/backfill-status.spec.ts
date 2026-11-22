import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { RedisRateLimiter } from './rate-limit.service.js';
import type { JobTrackingService } from '../../observability/job-tracking.service.js';
import type { ExternalApiRecorder } from '../../observability/external-api-recorder.js';
import type { StaleJobSweeper } from './stale-job.sweeper.js';

type MockProcedure = (...args: any[]) => any;

/** `vi.fn` with the explicit type parameter the lint rule requires. */
function mockFn<T extends MockProcedure>(implementation: T) {
  return vi.fn<T>(implementation);
}

interface RunState {
  id: string;
  status: string;
  finishedAt: Date | null;
}

const adapters = vi.hoisted(() => {
  const state = { reason: null as string | null, candles: [] as unknown[][] };
  class UpstoxClient {
    configurationReason() {
      return state.reason;
    }

    async fetchHistoricalCandles() {
      return { status: 'success', data: { candles: state.candles } };
    }
  }
  return {
    state,
    module: {
      UpstoxClient,
      classifyUpstoxError: () => ({
        kind: 'unknown',
        errorCode: null,
        message: 'unknown error',
        retryable: false,
        retryAfterSeconds: null,
      }),
      parseCandleEnvelope: (response: unknown) => response,
    },
  };
});

const db = vi.hoisted(() => {
  const state = {
    run: { id: 'job-1', status: 'running', finishedAt: null } as RunState,
    previousRun: null as RunState | null,
    mapping: { externalKey: 'NSE_EQ|INE002A01018' } as { externalKey: string } | null,
    releases: [] as { instrumentId: string; fetchStatus: string }[],
  };

  const latestRun = (options?: { excludeJobRunId?: string }) => {
    const runs = [state.previousRun, state.run].filter(
      (run): run is RunState =>
        run !== null &&
        !(options?.excludeJobRunId && run.id === options.excludeJobRunId),
    );
    return runs.at(-1) ?? null;
  };

  return {
    state,
    latestRun,
    module: {
      appendJobRunEvents: mockFn(async () => []),
      beginJobRunTracking: mockFn(async () => null),
      clearSystemIssue: mockFn(async () => null),
      clearSystemIssues: mockFn(async () => undefined),
      closeJobRun: mockFn(
        async (input: { jobRunId: string; status: string; result?: unknown }) => {
          if (input.jobRunId === state.run.id && state.run.status === 'running') {
            state.run.status = input.status;
            state.run.finishedAt = new Date();
          }
          return state.run;
        },
      ),
      correctStalledFetchStatus: mockFn(
        async (instrumentId: string, fetchStatus: string) => {
          state.releases.push({ instrumentId, fetchStatus });
          return null;
        },
      ),
      createRawProviderPayload: mockFn(async () => ({ id: 'raw-1' })),
      deleteAllCoverage: mockFn(async () => undefined),
      deleteJobRun: mockFn(async () => undefined),
      findProviderByCode: mockFn(async () => ({ id: 'provider-1' })),
      findProviderMapping: mockFn(async () => state.mapping),
      finishJobRunTracking: mockFn(async () => null),
      getCandleUpdatedAt: mockFn(async () => null),
      getCoverageInputs: mockFn(async () => []),
      getDailyAggregatesFromMinutes: mockFn(async () => []),
      getExistingCandles: mockFn(async () => []),
      getInstrumentListing: mockFn(async () => ({
        listedOn: null,
        delistedOn: null,
        isActive: true,
      })),
      getInstrumentStatusCounters: mockFn(async () => ({
        expectedDays: 1,
        completeDays: 1,
        partialDays: 0,
        missingDays: 0,
        openCriticalIssues: 0,
      })),
      getInstrumentStatusRow: mockFn(async () => ({
        targetFrom: '2022-01-01',
        targetTo: '2026-11-21',
      })),
      getInstrumentTickSize: mockFn(async () => '0.05'),
      getJobRun: mockFn(async () => ({ status: 'running' })),
      getLastSuccessfulJobForInstrument: mockFn(
        async (_instrumentId: string, options?: { excludeJobRunId?: string }) => {
          const run = latestRun(options);
          return run?.status === 'succeeded'
            ? { id: run.id, finishedAt: run.finishedAt }
            : null;
        },
      ),
      getLatestBackfillJobForInstrument: mockFn(
        async (_instrumentId: string, options?: { excludeJobRunId?: string }) =>
          latestRun(options),
      ),
      getLatestCompletedSession: mockFn(async () => '2026-11-21'),
      getPrimaryMappingCount: mockFn(async () => 1),
      getSyncTargetInstruments: mockFn(async () => []),
      getTradingCalendarRow: mockFn(async () => null),
      getTradingSessionsForRange: mockFn(async () => []),
      hasConfirmedCorporateAction: mockFn(async () => false),
      insertExternalApiCalls: mockFn(async () => undefined),
      isMonthComplete: mockFn(async () => false),
      listQueuedJobsOlderThan: mockFn(async () => []),
      markInstrumentFetchInFlight: mockFn(async () => null),
      markStaleJobsFailed: mockFn(async () => []),
      refreshDailyStats: mockFn(async () => undefined),
      resolveAbandonedQueuedJob: mockFn(async () => null),
      updateJobRun: mockFn(
        async (
          jobRunId: string,
          patch: { status?: string; finishedAt?: Date },
        ) => {
          if (jobRunId === state.run.id) {
            if (patch.status) state.run.status = patch.status;
            if (patch.finishedAt) state.run.finishedAt = patch.finishedAt;
          }
          return state.run;
        },
      ),
      upsertCoverageBatch: mockFn(async () => undefined),
      upsertInstrumentStatus: mockFn(async (values: { fetchStatus: string }) => values),
      upsertSystemIssue: mockFn(async () => null),
      writeCandles: mockFn(async () => ({
        inserted: 0,
        updated: 0,
        skipped: 0,
        revisions: [],
      })),
    },
  };
});

vi.mock('@ai-trading/adapters', () => adapters.module);
vi.mock('@ai-trading/database', () => db.module);

import { IngestionService } from './ingestion.service.js';
import { QualityService } from './quality.service.js';

const payload = {
  jobRunId: 'job-1',
  instrumentId: 'instrument-1',
  from: '2026-01-01',
  to: '2026-01-31',
  mode: 'missing_only',
};

function harness() {
  const config = {
    get: (_key: string, fallback: unknown) => fallback,
  } as unknown as ConfigService;
  const quality = new QualityService(config);
  quality.recomputeCoverage = mockFn(async () => ({
    complete: 0,
    partial: 0,
    missing: 0,
    datesChecked: 0,
  }));
  const tracking = {
    enterStage: mockFn(() => undefined),
    completeStage: mockFn(() => undefined),
    progress: mockFn(() => undefined),
    warning: mockFn(() => undefined),
  };
  const ingestion = new IngestionService(
    config,
    { acquire: mockFn(async () => undefined) } as unknown as RedisRateLimiter,
    quality,
    tracking as unknown as JobTrackingService,
    {} as ExternalApiRecorder,
    {} as StaleJobSweeper,
  );
  return { ingestion, tracking };
}

beforeEach(() => {
  adapters.state.reason = null;
  adapters.state.candles = [];
  db.state.run = { id: 'job-1', status: 'running', finishedAt: null };
  db.state.previousRun = null;
  db.state.mapping = { externalKey: 'NSE_EQ|INE002A01018' };
  db.state.releases = [];
  vi.clearAllMocks();
});

describe('historical backfill fetch status', () => {
  it('closes the run before recomputing, so a successful fetch lands on fetched', async () => {
    const { ingestion } = harness();

    await ingestion.runInstrumentBackfill(payload);

    expect(db.module.markInstrumentFetchInFlight).toHaveBeenCalledWith(
      'instrument-1',
      'fetching',
    );
    expect(db.module.closeJobRun).toHaveBeenCalled();
    expect(db.module.upsertInstrumentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ fetchStatus: 'fetched', instrumentId: 'instrument-1' }),
    );
  });

  it('does not report a skipped run as fetched', async () => {
    adapters.state.reason = 'Upstox credentials are not configured';
    const { ingestion } = harness();

    await ingestion.runInstrumentBackfill(payload);

    expect(db.module.upsertInstrumentStatus).not.toHaveBeenCalled();
    expect(db.state.releases).toEqual([
      { instrumentId: 'instrument-1', fetchStatus: 'not_requested' },
    ]);
  });

  it('keeps the previous verdict when a skipped run follows a successful one', async () => {
    adapters.state.reason = 'Upstox credentials are not configured';
    db.state.previousRun = {
      id: 'job-0',
      status: 'succeeded',
      finishedAt: new Date('2026-11-20T10:00:00Z'),
    };
    const { ingestion } = harness();

    await ingestion.runInstrumentBackfill(payload);

    expect(db.state.releases).toEqual([
      { instrumentId: 'instrument-1', fetchStatus: 'fetched' },
    ]);
  });

  it('settles a missing mapping as failed', async () => {
    db.state.mapping = null;
    const { ingestion } = harness();

    await ingestion.runInstrumentBackfill(payload);

    expect(db.state.releases).toEqual([
      { instrumentId: 'instrument-1', fetchStatus: 'failed' },
    ]);
  });
});
