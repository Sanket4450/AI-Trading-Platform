import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import {
  HISTORY_START,
  monthChunks,
  validateBackfillRange,
  type MonthChunk,
} from '@ai-trading/market-data';
import {
  createJobRun,
  findActiveBackfillRun,
  getCoverageMonths,
  getInstrumentsByIds,
  getLatestCompletedSession,
  getPlanJob,
  getTradingSessionsForRange,
  listChildJobRuns,
  recordAudit,
  updateJobRun,
} from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type { FetchInstrumentDto } from './dto/instrument-coverage-query.dto.js';

interface ScopedInstrument {
  instrumentId: string;
  symbol: string;
  name: string;
  tickSize: string;
  listedOn: string | null;
  delistedOn: string | null;
  isActive: boolean;
  externalKey: string | null;
}

interface FetchScope {
  instrument: ScopedInstrument;
  from: string;
  to: string;
}

/**
 * Per-instrument historical fetch: one parent plan job with a single child job.
 * Month-level ingestion runs are created by the worker from the child payload.
 */
@Injectable()
export class InstrumentIngestionService {
  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
  ) {}

  private async resolveScope(
    instrumentId: string,
    body: FetchInstrumentDto,
  ): Promise<FetchScope> {
    const [instrument] = (await getInstrumentsByIds([
      instrumentId,
    ])) as ScopedInstrument[];
    if (!instrument) throw new NotFoundException('Instrument not found');

    const lastCompleted = await getLatestCompletedSession();
    if (!lastCompleted) {
      throw new BadRequestException(
        'No completed NSE session is available in the calendar',
      );
    }
    const maxInstruments = this.config.get<number>(
      'DATA_BACKFILL_MAX_INSTRUMENTS',
      100,
    );
    const from = body.from ?? HISTORY_START;
    const to = body.to ?? lastCompleted;
    const errors = validateBackfillRange({
      from,
      to,
      lastCompletedSession: lastCompleted,
      maxInstruments,
      instrumentCount: 1,
    });
    if (errors.length > 0) throw new BadRequestException(errors.join('; '));
    return { instrument, from, to };
  }

  private effectiveWindow(
    instrument: ScopedInstrument,
    from: string,
    to: string,
  ) {
    const effectiveFrom =
      instrument.listedOn && instrument.listedOn > from
        ? instrument.listedOn
        : from;
    const effectiveTo =
      instrument.delistedOn && instrument.delistedOn < to
        ? instrument.delistedOn
        : to;
    return { from: effectiveFrom, to: effectiveTo };
  }

  private async buildPreview(scope: FetchScope, mode: string) {
    const { instrument, from, to } = scope;
    const blocked = instrument.externalKey
      ? []
      : [
          {
            instrumentId: instrument.instrumentId,
            symbol: instrument.symbol,
            reason: 'mapping_missing',
          },
        ];
    const window = this.effectiveWindow(instrument, from, to);
    const chunks =
      window.to < window.from ? [] : monthChunks(window.from, window.to);
    const coverageMonths = await getCoverageMonths(
      [instrument.instrumentId],
      from,
      to,
    );
    const completeMonths = new Set(
      coverageMonths
        .filter((row) => row.total > 0 && row.complete === row.total)
        .map((row) => row.month),
    );
    const uniqueMonths = new Map<string, MonthChunk>();
    let skippedMonths = 0;
    let requestCount = 0;
    for (const chunk of chunks) {
      uniqueMonths.set(`${chunk.from}:${chunk.to}`, chunk);
      if (mode !== 'force' && completeMonths.has(chunk.from.slice(0, 7))) {
        skippedMonths += 1;
      } else {
        requestCount += 1;
      }
    }
    const calendar = await getTradingSessionsForRange(from, to);
    const sessions = calendar.filter((row) => row.is_trading_day).length;
    return {
      instrumentCount: 1,
      resolved: instrument.externalKey ? 1 : 0,
      blocked,
      sessionCount: sessions,
      monthCount: uniqueMonths.size,
      skippedMonths,
      requestCount,
      estimatedBars: sessions * 375,
      estimatedBytes: requestCount * 200_000,
      from,
      to,
      months: [...uniqueMonths.values()],
    };
  }

  async fetch(
    instrumentId: string,
    body: FetchInstrumentDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    if (body.mode === 'force' && !body.reason?.trim()) {
      throw new BadRequestException('A force refresh requires a reason');
    }
    const scope = await this.resolveScope(instrumentId, body);
    const mode = body.mode ?? 'missing_only';
    const preview = await this.buildPreview(scope, mode);
    if (body.dryRun !== false) {
      return { dryRun: true, preview };
    }

    const active = await findActiveBackfillRun(instrumentId);
    if (active) {
      return {
        dryRun: false,
        preview,
        plan: null,
        queued: [],
        existingRunIds: [{ instrumentId, runId: active.id }],
      };
    }
    if (!scope.instrument.externalKey) {
      throw new BadRequestException(
        `Instrument ${scope.instrument.symbol} has no provider mapping`,
      );
    }

    const window = this.effectiveWindow(scope.instrument, scope.from, scope.to);
    if (window.to < window.from) {
      throw new BadRequestException(
        'The requested window is outside the listing',
      );
    }

    const parent = await createJobRun({
      jobName: 'backfill-plan',
      queueName: QUEUES.historicalData,
      jobType: 'ingestion',
      status: 'queued',
      payload: {
        instrumentIds: [instrumentId],
        from: scope.from,
        to: scope.to,
        mode,
        reason: body.reason ?? null,
      },
      correlationId: meta.requestId,
    });
    const child = await createJobRun({
      jobName: 'historical-backfill',
      queueName: QUEUES.historicalData,
      jobType: 'ingestion',
      status: 'queued',
      payload: {
        parentJobRunId: parent.id,
        instrumentId,
        from: window.from,
        to: window.to,
        mode,
        reason: body.reason ?? null,
      },
      correlationId: parent.id,
    });

    try {
      await this.historicalQueue.add(
        'historical-backfill',
        {
          jobRunId: child.id,
          parentJobRunId: parent.id,
          instrumentId,
          from: window.from,
          to: window.to,
          mode,
          reason: body.reason ?? null,
        },
        {
          jobId: child.id,
          priority: 10,
          attempts: 1,
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      );
    } catch (error) {
      await updateJobRun(child.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Queue unavailable',
      });
      await updateJobRun(parent.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: 'No instrument could be queued',
      });
      throw new ServiceUnavailableException(
        'The background queue is unavailable',
      );
    }

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.instruments_fetch_requested',
      entityType: 'job_run',
      entityId: parent.id,
      beforeState: null,
      afterState: {
        instrumentId,
        from: window.from,
        to: window.to,
        mode,
        reason: body.reason ?? null,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      dryRun: false,
      preview,
      plan: parent,
      queued: [
        {
          instrumentId,
          symbol: scope.instrument.symbol,
          jobRunId: child.id,
          from: window.from,
          to: window.to,
        },
      ],
      existingRunIds: [],
    };
  }

  async cancel(instrumentId: string, actorUserId: string, meta: RequestMeta) {
    const active = await findActiveBackfillRun(instrumentId);
    if (!active) {
      throw new NotFoundException(
        'No active backfill run for this instrument',
      );
    }
    if (!active.parentJobRunId) {
      throw new BadRequestException('The active run has no parent plan');
    }
    const plan = await getPlanJob(active.parentJobRunId);
    if (!plan) throw new NotFoundException('Parent plan not found');
    const children = await listChildJobRuns(plan.id);
    const child = children.find(
      (candidate) =>
        (candidate.payload as Record<string, unknown> | null)?.instrumentId ===
        instrumentId,
    );
    if (child) {
      await updateJobRun(child.id, {
        status: 'cancelled',
        finishedAt: new Date(),
      });
    } else {
      await updateJobRun(plan.id, {
        status: 'cancelled',
        finishedAt: new Date(),
      });
    }
    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.instrument_cancelled',
      entityType: 'job_run',
      entityId: child?.id ?? plan.id,
      beforeState: { status: child?.status ?? plan.status },
      afterState: { status: 'cancelled', instrumentId },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { planId: plan.id, instrumentId, status: 'cancelled' };
  }
}
