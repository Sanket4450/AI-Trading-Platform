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
  findActiveBackfillRuns,
  getBackfillPlanDetail,
  getCoverageMonths,
  getInstrumentsByIds,
  getLatestCompletedSession,
  getPlanJob,
  getTradingSessionsForRange,
  getUniverseMembersForBackfill,
  listBackfillPlans,
  listChildJobRuns,
  recordAudit,
  updateJobRun,
} from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type {
  CreateBackfillPlanDto,
  FetchInstrumentsDto,
} from './dto/r2-data.dto.js';

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

interface Scope {
  instruments: ScopedInstrument[];
  blocked: { instrumentId: string; symbol: string; reason: string }[];
  from: string;
  to: string;
}

@Injectable()
export class BackfillPlanService {
  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
  ) {}

  private async resolveScope(body: {
    instrumentIds?: string[];
    universeCode?: string;
    from?: string;
    to?: string;
  }): Promise<Scope> {
    const lastCompleted = await getLatestCompletedSession();
    if (!lastCompleted) {
      throw new BadRequestException(
        'No completed NSE session is available in the calendar',
      );
    }
    let instruments: ScopedInstrument[];
    if (body.instrumentIds && body.instrumentIds.length > 0) {
      instruments = (await getInstrumentsByIds(
        body.instrumentIds,
      )) as ScopedInstrument[];
    } else {
      instruments = (await getUniverseMembersForBackfill(
        body.universeCode ?? 'nifty-50',
      )) as ScopedInstrument[];
    }
    if (instruments.length === 0) {
      throw new BadRequestException('The request resolves to zero instruments');
    }
    const maxInstruments = this.config.get<number>(
      'DATA_BACKFILL_MAX_INSTRUMENTS',
      100,
    );
    if (instruments.length > maxInstruments) {
      throw new BadRequestException(
        `At most ${maxInstruments} instruments are allowed`,
      );
    }
    const from = body.from ?? HISTORY_START;
    const to = body.to ?? lastCompleted;
    const errors = validateBackfillRange({
      from,
      to,
      lastCompletedSession: lastCompleted,
      maxInstruments,
      instrumentCount: instruments.length,
    });
    if (errors.length > 0) throw new BadRequestException(errors.join('; '));

    const blocked = instruments
      .filter((instrument) => !instrument.externalKey)
      .map((instrument) => ({
        instrumentId: instrument.instrumentId,
        symbol: instrument.symbol,
        reason: 'mapping_missing',
      }));
    return { instruments, blocked, from, to };
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

  async preview(body: FetchInstrumentsDto | CreateBackfillPlanDto) {
    const scope = await this.resolveScope(body);
    const ids = scope.instruments.map((instrument) => instrument.instrumentId);
    const coverageMonths = await getCoverageMonths(ids, scope.from, scope.to);
    const completeByInstrument = new Map<string, Set<string>>();
    for (const row of coverageMonths) {
      if (row.total > 0 && row.complete === row.total) {
        const set =
          completeByInstrument.get(row.instrumentId) ?? new Set<string>();
        set.add(row.month);
        completeByInstrument.set(row.instrumentId, set);
      }
    }
    const calendar = await getTradingSessionsForRange(scope.from, scope.to);
    const sessions = calendar.filter((row) => row.is_trading_day).length;
    const uniqueMonths = new Map<string, MonthChunk>();
    let skippedMonths = 0;
    let requestCount = 0;
    for (const instrument of scope.instruments) {
      if (!instrument.externalKey) continue;
      const window = this.effectiveWindow(instrument, scope.from, scope.to);
      if (window.to < window.from) continue;
      const chunks = monthChunks(window.from, window.to);
      const complete =
        completeByInstrument.get(instrument.instrumentId) ?? new Set<string>();
      for (const chunk of chunks) {
        uniqueMonths.set(`${chunk.from}:${chunk.to}`, chunk);
        const month = chunk.from.slice(0, 7);
        if (body.mode !== 'force' && complete.has(month)) skippedMonths += 1;
        else requestCount += 1;
      }
    }
    const averageBars = 375;
    const estimatedBars = sessions * averageBars * scope.instruments.length;
    return {
      instrumentCount: scope.instruments.length,
      resolved: scope.instruments.length - scope.blocked.length,
      blocked: scope.blocked,
      sessionCount: sessions,
      monthCount: uniqueMonths.size,
      skippedMonths,
      requestCount,
      estimatedBars,
      estimatedBytes: requestCount * 200_000,
      from: scope.from,
      to: scope.to,
      months: [...uniqueMonths.values()],
    };
  }

  async launch(
    body: CreateBackfillPlanDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    if (body.mode === 'force' && !body.reason?.trim()) {
      throw new BadRequestException('A force refresh requires a reason');
    }
    const scope = await this.resolveScope(body);
    const preview = await this.preview(body);
    const ids = scope.instruments.map((instrument) => instrument.instrumentId);
    const active = await findActiveBackfillRuns(ids);
    const activeIds = new Set(active.map((run) => run.instrumentId));
    const queueable = scope.instruments.filter(
      (instrument) =>
        instrument.externalKey && !activeIds.has(instrument.instrumentId),
    );
    const existingRunIds = active.map((run) => ({
      instrumentId: run.instrumentId,
      runId: run.id,
    }));

    if (queueable.length === 0) {
      return { plan: null, preview, queued: [], existingRunIds };
    }

    const parent = await createJobRun({
      jobName: 'backfill-plan',
      queueName: QUEUES.historicalData,
      jobType: 'ingestion',
      status: 'queued',
      payload: {
        instrumentIds: queueable.map((instrument) => instrument.instrumentId),
        from: scope.from,
        to: scope.to,
        mode: body.mode,
        reason: body.reason ?? null,
      },
      correlationId: meta.requestId,
    });

    const queued: {
      instrumentId: string;
      symbol: string;
      jobRunId: string;
      from: string;
      to: string;
    }[] = [];
    for (const instrument of queueable) {
      const window = this.effectiveWindow(instrument, scope.from, scope.to);
      if (window.to < window.from) continue;
      const child = await createJobRun({
        jobName: 'historical-backfill',
        queueName: QUEUES.historicalData,
        jobType: 'ingestion',
        status: 'queued',
        payload: {
          parentJobRunId: parent.id,
          instrumentId: instrument.instrumentId,
          from: window.from,
          to: window.to,
          mode: body.mode,
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
            instrumentId: instrument.instrumentId,
            from: window.from,
            to: window.to,
            mode: body.mode,
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
        queued.push({
          instrumentId: instrument.instrumentId,
          symbol: instrument.symbol,
          jobRunId: child.id,
          from: window.from,
          to: window.to,
        });
      } catch (error) {
        await updateJobRun(child.id, {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : 'Queue unavailable',
        });
      }
    }

    if (queued.length === 0) {
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
      action: 'data.backfill_plan_created',
      entityType: 'job_run',
      entityId: parent.id,
      beforeState: null,
      afterState: {
        instruments: queued.length,
        from: scope.from,
        to: scope.to,
        mode: body.mode,
        reason: body.reason ?? null,
        existingRunIds,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { plan: parent, preview, queued, existingRunIds };
  }

  async fetchInstruments(
    body: FetchInstrumentsDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const preview = await this.preview(body);
    if (body.dryRun !== false) {
      return { dryRun: true, preview };
    }
    const launched = await this.launch(
      {
        instrumentIds: body.instrumentIds,
        universeCode: body.universeCode,
        from: body.from ?? HISTORY_START,
        to:
          body.to ??
          (await getLatestCompletedSession()) ??
          new Date().toISOString().slice(0, 10),
        mode: body.mode ?? 'missing_only',
        reason: body.reason,
        dryRun: false,
      },
      actorUserId,
      meta,
    );
    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.instruments_fetch_requested',
      entityType: 'job_run',
      entityId: launched.plan?.id ?? null,
      beforeState: null,
      afterState: {
        instruments: launched.queued.length,
        existingRunIds: launched.existingRunIds,
        mode: body.mode ?? 'missing_only',
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { dryRun: false, ...launched };
  }

  list(limit = 50) {
    return listBackfillPlans(limit);
  }

  async detail(id: string) {
    const detail = await getBackfillPlanDetail(id);
    if (!detail) throw new NotFoundException('Backfill plan not found');
    return detail;
  }

  async cancelPlan(id: string, actorUserId: string, meta: RequestMeta) {
    const plan = await getPlanJob(id);
    if (!plan) throw new NotFoundException('Backfill plan not found');
    const updated = await updateJobRun(id, {
      status: 'cancelled',
      finishedAt: new Date(),
      errorMessage: null,
    });
    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.backfill_plan_cancelled',
      entityType: 'job_run',
      entityId: id,
      beforeState: { status: plan.status },
      afterState: { status: 'cancelled' },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  async cancelInstrument(
    instrumentId: string,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const active = await findActiveBackfillRun(instrumentId);
    if (!active)
      throw new NotFoundException('No active backfill run for this instrument');
    if (!active.parentJobRunId)
      throw new BadRequestException('The active run has no parent plan');
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

  async childJobs(planId: string) {
    return listChildJobRuns(planId);
  }
}
