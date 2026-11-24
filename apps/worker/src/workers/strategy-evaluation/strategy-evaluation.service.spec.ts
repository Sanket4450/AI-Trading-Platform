import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ORB_CODE_REF,
  ORB_PARAMETER_DEFAULTS,
  ORB_PARAMETER_SCHEMA,
  ORB_STRATEGY_CODE,
} from '@ai-trading/domain';

const runId = '11111111-1111-1111-1111-111111111111';
const jobRunId = '22222222-2222-2222-2222-222222222222';
const versionId = '33333333-3333-3333-3333-333333333333';
const configurationId = '44444444-4444-4444-4444-444444444444';
const riskId = '55555555-5555-5555-5555-555555555555';
const accountId = '66666666-6666-6666-6666-666666666666';
const indexId = '77777777-7777-7777-7777-777777777777';
const equityId = '88888888-8888-8888-8888-888888888888';

const run = {
  id: runId,
  strategyVersionId: versionId,
  configurationVersionId: configurationId,
  riskConfigurationVersionId: riskId,
  accountId,
  fromDate: '2026-09-01',
  toDate: '2026-09-01',
  initialCapital: '1000000.00',
  universe: {
    market: { id: indexId, symbol: 'NIFTY 50', exchange: 'NSE' },
    resolved: [{ id: equityId, symbol: 'RELIANCE' }],
    requestedIds: [equityId],
    excluded: [],
  },
  status: 'queued',
  note: null,
  jobRunId,
  error: null,
  createdBy: 'actor',
  createdAt: new Date(),
  startedAt: null,
  finishedAt: null,
  strategyId: 'strategy',
  strategyCode: ORB_STRATEGY_CODE,
  strategyName: 'ORB',
  version: 2,
  codeRef: ORB_CODE_REF,
  parameterSchema: ORB_PARAMETER_SCHEMA,
  versionStatus: 'active',
  parameterPayload: ORB_PARAMETER_DEFAULTS,
  parameterVersion: 1,
  parameterHash: 'hash',
};

const db = vi.hoisted(() => ({
  deleteEvaluationRunArtifacts: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getCorporateActionsInRange: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getCoverageInRange: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getEvaluationRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getEvaluationRunRiskConfiguration: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getFinalCandlesForDay: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getFiveMinuteSlotVolume: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getIndexCandlesForDates: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getInstrumentsByIds: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getJobRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getPriorTradingDaysBefore: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getTradingDaysInRange: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  replaceEvaluationDay: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  updateEvaluationRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  updateJobRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('@ai-trading/database', () => db);

import { StrategyEvaluationService } from './strategy-evaluation.service.js';
import type { JobTrackingService } from '../../observability/job-tracking.service.js';

function tracker() {
  return {
    enterStage: vi.fn<(...args: unknown[]) => void>(),
    progress: vi.fn<(...args: unknown[]) => void>(),
    completeStage: vi.fn<(...args: unknown[]) => void>(),
    warning: vi.fn<(...args: unknown[]) => void>(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.getEvaluationRun.mockResolvedValue(run);
  db.getEvaluationRunRiskConfiguration.mockResolvedValue({
    version: 1,
    payload: {
      riskPerTradePct: 0.005,
      dailyLossLimitPct: 0.01,
      maxOpenPositions: 1,
      maxEntriesPerDay: 2,
      maxDrawdownPct: 0.08,
      killSwitchEnabled: true,
    },
  });
  const instrumentRows = [
    {
      instrumentId: equityId,
      symbol: 'RELIANCE',
      name: 'Reliance',
      tickSize: '0.05',
      listedOn: null,
      delistedOn: null,
      isActive: true,
      externalKey: 'NSE_EQ|INE002A01018',
    },
    {
      instrumentId: indexId,
      symbol: 'NIFTY 50',
      name: 'NIFTY 50',
      tickSize: '0.05',
      listedOn: null,
      delistedOn: null,
      isActive: true,
      externalKey: 'NSE_INDEX|Nifty 50',
    },
  ];
  db.getInstrumentsByIds.mockImplementation(async (ids) => {
    const requested = new Set(ids as string[]);
    return instrumentRows.filter((row) => requested.has(row.instrumentId));
  });
  db.deleteEvaluationRunArtifacts.mockResolvedValue(undefined);
  db.updateEvaluationRun.mockResolvedValue(run);
  db.updateJobRun.mockResolvedValue(null);
  db.getJobRun.mockResolvedValue({ status: 'running' });
  db.getTradingDaysInRange.mockResolvedValue([
    {
      tradingDate: '2026-09-01',
      isTradingDay: true,
      sessionOpen: new Date('2026-09-01T03:45:00.000Z'),
      sessionClose: new Date('2026-09-01T10:00:00.000Z'),
      description: null,
    },
  ]);
  db.getPriorTradingDaysBefore.mockResolvedValue([]);
  db.getCoverageInRange.mockResolvedValue([
    { instrumentId: indexId, tradingDate: '2026-09-01', expectedBars: 375, storedBars: 375 },
    { instrumentId: equityId, tradingDate: '2026-09-01', expectedBars: 375, storedBars: 375 },
  ]);
  db.getCorporateActionsInRange.mockResolvedValue([]);
  db.getFinalCandlesForDay.mockResolvedValue([]);
  db.getIndexCandlesForDates.mockResolvedValue([]);
  db.getFiveMinuteSlotVolume.mockResolvedValue([]);
  db.replaceEvaluationDay.mockResolvedValue({ results: 1, signals: 0 });
});

describe('strategy evaluation worker', () => {
  it('rejects an unknown job name', async () => {
    const service = new StrategyEvaluationService(tracker() as unknown as JobTrackingService);
    await expect(service.run('historical-backfill', {})).rejects.toThrow(
      /unknown strategy-evaluation job/i,
    );
  });

  it('prepares, evaluates and finalizes a day with persisted skip reasons', async () => {
    const tracking = tracker();
    const service = new StrategyEvaluationService(tracking as unknown as JobTrackingService);

    await service.run('strategy-evaluation', { jobRunId, evaluationRunId: runId });

    expect(db.deleteEvaluationRunArtifacts).toHaveBeenCalledWith(runId);
    expect(db.updateEvaluationRun).toHaveBeenNthCalledWith(
      1,
      runId,
      expect.objectContaining({ status: 'running' }),
    );
    expect(db.replaceEvaluationDay).toHaveBeenCalledTimes(1);
    const day = db.replaceEvaluationDay.mock.calls[0]![0] as {
      results: { status: string; reasonCode: string }[];
    };
    expect(day.results).toHaveLength(1);
    expect(day.results[0]?.status).toBe('skipped');
    expect(day.results[0]?.reasonCode).toBe('warmup');
    expect(db.updateEvaluationRun).toHaveBeenLastCalledWith(
      runId,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(tracking.completeStage).toHaveBeenCalledWith(
      jobRunId,
      'finalize',
      'completed',
      expect.objectContaining({ days: 1 }),
    );
  });

  it('marks the run cancelled between days without persisting the next day', async () => {
    db.getJobRun.mockResolvedValue({ status: 'cancelled' });
    const tracking = tracker();
    const service = new StrategyEvaluationService(tracking as unknown as JobTrackingService);

    const result = await service.run('strategy-evaluation', {
      jobRunId,
      evaluationRunId: runId,
    });

    expect(result).toMatchObject({ cancelled: true, days: 0 });
    expect(db.replaceEvaluationDay).not.toHaveBeenCalled();
    expect(db.updateEvaluationRun).toHaveBeenLastCalledWith(
      runId,
      expect.objectContaining({ status: 'cancelled' }),
    );
  });
});
