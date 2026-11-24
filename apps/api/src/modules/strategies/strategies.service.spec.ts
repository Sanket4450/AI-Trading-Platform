import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import {
  ORB_CODE_REF,
  ORB_PARAMETER_SCHEMA,
  ORB_PARAMETER_DEFAULTS,
  ORB_STRATEGY_CODE,
} from '@ai-trading/domain';

const strategyId = '11111111-1111-1111-1111-111111111111';
const versionId = '22222222-2222-2222-2222-222222222222';
const runId = '33333333-3333-3333-3333-333333333333';
const jobId = '44444444-4444-4444-4444-444444444444';
const accountId = '55555555-5555-5555-5555-555555555555';
const indexId = '66666666-6666-6666-6666-666666666666';
const equityId = '77777777-7777-7777-7777-777777777777';
const parametersId = '88888888-8888-8888-8888-888888888888';
const riskId = '99999999-9999-9999-9999-999999999999';

const run = {
  id: runId,
  strategyVersionId: versionId,
  configurationVersionId: parametersId,
  riskConfigurationVersionId: riskId,
  accountId,
  fromDate: '2026-09-01',
  toDate: '2026-09-05',
  initialCapital: '1000000.00',
  universe: {},
  status: 'queued',
  note: null,
  jobRunId: jobId,
  error: null,
  createdBy: 'actor',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  startedAt: null,
  finishedAt: null,
  strategyId,
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

const strategy = {
  id: strategyId,
  code: ORB_STRATEGY_CODE,
  name: 'ORB',
  description: null,
  status: 'active',
  createdBy: 'actor',
  createdAt: new Date(),
  updatedAt: new Date(),
  versions: [
    {
      id: versionId,
      strategyId,
      version: 2,
      codeRef: ORB_CODE_REF,
      parameterSchema: ORB_PARAMETER_SCHEMA,
      status: 'active',
      changelog: null,
      releasedAt: new Date(),
      createdBy: 'actor',
      createdAt: new Date(),
      bindings: [],
      activations: [],
    },
  ],
};

const db = vi.hoisted(() => ({  createStrategyVersion: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getStrategy: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getStrategySummary: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getStrategyVersion: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listStrategies: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  recordAudit: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  resolveEffectiveConfiguration: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  cancelEvaluationRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createEvaluationRunWithJob: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  deleteEvaluationRunAndJob: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  findActiveEvaluationRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getConfigurationVersion: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getEvaluationRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getEvaluationRunRiskConfiguration: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getEvaluationRunSummary: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getNifty50IndexInstruments: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getSignalForStrategy: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getSyncTargetEquities: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getTradingCalendarBounds: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getTradingDaysInRange: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listActiveResearchAccounts: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listEvaluationResults: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listEvaluationRuns: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  listSignals: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  updateJobRun: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('@ai-trading/database', () => db);

import { StrategiesService } from './strategies.service.js';
import type { CreateEvaluationRunDto } from './dto/create-evaluation-run.dto.js';

const body: CreateEvaluationRunDto = {
  strategyVersionId: versionId,
  fromDate: '2026-09-01',
  toDate: '2026-09-05',
  initialCapital: 1_000_000,
};

const meta = {
  requestId: 'request-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

function harness() {
  const queue = {
    add: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    remove: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  };
  queue.add.mockResolvedValue({ id: jobId });
  queue.remove.mockResolvedValue(undefined);
  const service = new StrategiesService(queue as unknown as Queue);
  return { service, queue };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.getStrategy.mockResolvedValue(strategy);
  db.getEvaluationRun.mockResolvedValue(run);
  db.resolveEffectiveConfiguration.mockImplementation(async (_versionId: unknown, role: unknown) =>
    role === 'parameters'
      ? {
          configurationVersionId: parametersId,
          payload: ORB_PARAMETER_DEFAULTS,
          payloadHash: 'hash',
          version: 1,
        }
      : {
          configurationVersionId: riskId,
          payload: {
            riskPerTradePct: 0.005,
            dailyLossLimitPct: 0.01,
            maxOpenPositions: 1,
            maxEntriesPerDay: 2,
            maxDrawdownPct: 0.08,
            killSwitchEnabled: true,
          },
          payloadHash: 'risk-hash',
          version: 1,
        },
  );
  db.createEvaluationRunWithJob.mockResolvedValue({
    run: { id: runId },
    jobRun: { id: jobId },
  });
  db.findActiveEvaluationRun.mockResolvedValue(null);
  db.listActiveResearchAccounts.mockResolvedValue([
    { id: accountId, code: 'upstox', mode: 'research' },
  ]);
  db.getNifty50IndexInstruments.mockResolvedValue([
    { id: indexId, symbol: 'NIFTY 50', exchange: 'NSE' },
  ]);
  db.getSyncTargetEquities.mockResolvedValue([
    { id: equityId, symbol: 'RELIANCE', segment: 'NSE_EQ', instrumentType: 'EQ' },
  ]);
  db.getTradingCalendarBounds.mockResolvedValue({
    fromDate: '2022-01-01',
    toDate: '2027-12-31',
  });
  db.getTradingDaysInRange.mockResolvedValue([{ tradingDate: '2026-09-01' }]);
  db.getEvaluationRunSummary.mockResolvedValue({
    instrumentDays: 0,
    instrumentsWithSignals: 0,
    entries: 0,
    exits: 0,
    skippedDays: 0,
    noSignalDays: 0,
  });
  db.getEvaluationRunRiskConfiguration.mockResolvedValue({ version: 1, payload: {} });
});

describe('createEvaluationRun', () => {
  it('pins inputs, enqueues with the ledger id and audits the run', async () => {
    const { service, queue } = harness();

    await service.createEvaluationRun(strategyId, body, 'actor', meta);

    expect(db.createEvaluationRunWithJob).toHaveBeenCalledWith(
      expect.objectContaining({
        strategyVersionId: versionId,
        configurationVersionId: parametersId,
        riskConfigurationVersionId: riskId,
        accountId,
        initialCapital: '1000000.00',
        createdBy: 'actor',
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'strategy-evaluation',
      { jobRunId: jobId, evaluationRunId: runId },
      expect.objectContaining({ jobId, attempts: 1 }),
    );
    expect(db.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'strategy.evaluation_run.created', entityId: runId }),
    );
  });

  it('refuses a version whose implementation is not registered', async () => {
    const { service, queue } = harness();
    db.getStrategy.mockResolvedValue({
      ...strategy,
      versions: [{ ...strategy.versions[0]!, codeRef: 'r1-seed' }],
    });

    await expect(service.createEvaluationRun(strategyId, body, 'actor', meta)).rejects.toThrow(
      /code_ref/i,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('refuses a second active run for the same version', async () => {
    const { service, queue } = harness();
    db.findActiveEvaluationRun.mockResolvedValue({ id: 'active' });

    await expect(service.createEvaluationRun(strategyId, body, 'actor', meta)).rejects.toThrow(
      /already queued or running/i,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rolls the run and job back when the queue is unavailable', async () => {
    const { service, queue } = harness();
    queue.add.mockRejectedValueOnce(new Error('redis down'));

    await expect(service.createEvaluationRun(strategyId, body, 'actor', meta)).rejects.toThrow(
      'The background queue is unavailable',
    );
    expect(db.deleteEvaluationRunAndJob).toHaveBeenCalledWith(runId, jobId);
  });

  it('rejects an unknown instrument in the requested universe', async () => {
    const { service } = harness();
    await expect(
      service.createEvaluationRun(
        strategyId,
        {
          strategyVersionId: body.strategyVersionId,
          fromDate: body.fromDate,
          toDate: body.toDate,
          initialCapital: body.initialCapital,
          instrumentIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        },
        'actor',
        meta,
      ),
    ).rejects.toThrow(/sync-target equity/i);
  });
});

describe('cancelEvaluationRun', () => {
  it('cancels the job ledger and queue entry', async () => {
    const { service, queue } = harness();
    db.getEvaluationRun.mockResolvedValue({ ...run, status: 'running' });
    db.cancelEvaluationRun.mockResolvedValue({ ...run, status: 'cancelled' });

    await service.cancelEvaluationRun(strategyId, runId, 'actor', meta);

    expect(db.cancelEvaluationRun).toHaveBeenCalledWith(runId);
    expect(db.updateJobRun).toHaveBeenCalledWith(jobId, {
      status: 'cancelled',
      finishedAt: expect.any(Date),
    });
    expect(queue.remove).toHaveBeenCalledWith(jobId);
    expect(db.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'strategy.evaluation_run.cancelled' }),
    );
  });

  it('returns a terminal run without touching the queue', async () => {
    const { service, queue } = harness();
    db.getEvaluationRun.mockResolvedValue({ ...run, status: 'completed' });

    await service.cancelEvaluationRun(strategyId, runId, 'actor', meta);

    expect(db.cancelEvaluationRun).not.toHaveBeenCalled();
    expect(queue.remove).not.toHaveBeenCalled();
  });
});
