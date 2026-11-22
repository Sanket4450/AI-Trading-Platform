import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

type MockProcedure = (...args: any[]) => any;

/** `vi.fn` with the explicit type parameter the lint rule requires. */
function mockFn<T extends MockProcedure>(implementation: T) {
  return vi.fn<T>(implementation);
}

const db = vi.hoisted(() => ({
  getInstrumentsByIds: mockFn(async () => [
    {
      instrumentId: 'instrument-1',
      symbol: 'RELIANCE',
      name: 'Reliance Industries',
      tickSize: '0.0500',
      listedOn: null,
      delistedOn: null,
      isActive: true,
      externalKey: 'NSE_EQ|INE002A01018',
    },
  ]),
  getLatestCompletedSession: mockFn(async () => '2026-11-21'),
  getCoverageMonths: mockFn(async () => []),
  getTradingSessionsForRange: mockFn(async () => []),
  findActiveBackfillJob: mockFn(async () => null),
  createJobRun: mockFn(async () => ({ id: 'job-1', status: 'queued' })),
  markInstrumentFetchInFlight: mockFn(async () => null),
  deleteJobRun: mockFn(async () => undefined),
  getLatestBackfillJobForInstrument: mockFn(async () => null),
  correctStalledFetchStatus: mockFn(async () => null),
  recordAudit: mockFn(async () => undefined),
  updateJobRun: mockFn(async () => null),
}));

vi.mock('@ai-trading/database', () => db);

import { InstrumentIngestionService } from './instrument-ingestion.service.js';

function harness() {
  const queue = { add: mockFn(async () => ({ id: 'job-1' })) };
  const config = {
    get: (_key: string, fallback: unknown) => fallback,
  } as unknown as ConfigService;
  const service = new InstrumentIngestionService(
    config,
    queue as unknown as Queue,
  );
  return { service, queue };
}

const body = { dryRun: false };
const actor = 'user-1';
const meta = {
  requestId: 'request-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.findActiveBackfillJob.mockResolvedValue(null);
  db.getLatestBackfillJobForInstrument.mockResolvedValue(null);
});

describe('instrument fetch enqueue', () => {
  it('marks the instrument queued before the job reaches the queue', async () => {
    const { service, queue } = harness();

    await service.fetch('instrument-1', body, actor, meta);

    expect(db.markInstrumentFetchInFlight).toHaveBeenCalledWith(
      'instrument-1',
      'queued',
    );
    expect(db.markInstrumentFetchInFlight.mock.invocationCallOrder[0]).toBeLessThan(
      queue.add.mock.invocationCallOrder[0]!,
    );
  });

  it('releases the queued marker when the queue rejects the job', async () => {
    const { service, queue } = harness();
    queue.add.mockRejectedValueOnce(new Error('redis down'));

    await expect(service.fetch('instrument-1', body, actor, meta)).rejects.toThrow(
      'The background queue is unavailable',
    );

    expect(db.deleteJobRun).toHaveBeenCalledWith('job-1');
    expect(db.correctStalledFetchStatus).toHaveBeenCalledWith(
      'instrument-1',
      'not_requested',
    );
  });
});
