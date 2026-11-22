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
  deriveFetchStatus,
  monthChunks,
  validateBackfillRange,
  type MonthChunk,
} from '@ai-trading/market-data';
import {
  correctStalledFetchStatus,
  createJobRun,
  deleteJobRun,
  findActiveBackfillJob,
  getCoverageMonths,
  getInstrumentsByIds,
  getLatestBackfillJobForInstrument,
  getLatestCompletedSession,
  getTradingSessionsForRange,
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
 * Month chunks are derived from the child payload and tracked on the job timeline.
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

    const active = await findActiveBackfillJob(instrumentId);
    if (active) {
      return {
        dryRun: false,
        preview,
        job: null,
        queued: [],
        existingJobIds: [{ instrumentId, jobRunId: active.id }],
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

    const job = await createJobRun({
      jobName: 'historical-backfill',
      instrumentId,
      status: 'queued',
      payload: {
        from: scope.from,
        to: scope.to,
        mode,
        reason: body.reason ?? null,
      },
      maxAttempts: 1,
    });

    try {
      await this.historicalQueue.add(
        'historical-backfill',
        {
          jobRunId: job.id,
          instrumentId,
          from: window.from,
          to: window.to,
          mode,
          reason: body.reason ?? null,
        },
        {
          jobId: job.id,
          priority: 10,
          attempts: 1,
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      );
    } catch {
      await deleteJobRun(job.id);
      throw new ServiceUnavailableException(
        'The background queue is unavailable',
      );
    }

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.instruments_fetch_requested',
      entityType: 'job_run',
      entityId: job.id,
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
      job,
      queued: [
        {
          instrumentId,
          symbol: scope.instrument.symbol,
          jobRunId: job.id,
          from: window.from,
          to: window.to,
        },
      ],
      existingJobIds: [],
    };
  }

  async cancel(instrumentId: string, actorUserId: string, meta: RequestMeta) {
    const active = await findActiveBackfillJob(instrumentId);

    if (!active) {
      // Nothing to cancel: the projection claims a fetch is in flight, so correct it instead of
      // failing. Cancel stays safe to repeat.
      const fetchStatus = await this.repairFetchStatus(instrumentId);
      await recordAudit({
        actorUserId,
        accountId: null,
        action: 'data.instrument_cancel_noop',
        entityType: 'instrument',
        entityId: instrumentId,
        beforeState: null,
        afterState: { instrumentId, fetchStatus },
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return {
        jobRunId: null,
        instrumentId,
        status: 'not_running',
        fetchStatus,
      };
    }

    await updateJobRun(active.id, {
      status: 'cancelled',
      finishedAt: new Date(),
    });
    await this.historicalQueue.remove(active.id).catch(() => undefined);

    const fetchStatus = await this.repairFetchStatus(instrumentId);
    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.instrument_cancelled',
      entityType: 'job_run',
      entityId: active.id,
      beforeState: { status: active.status },
      afterState: { status: 'cancelled', instrumentId, fetchStatus },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return {
      jobRunId: active.id,
      instrumentId,
      status: 'cancelled',
      fetchStatus,
    };
  }

  /** Re-derives fetch status from the latest backfill run, so a stalled row leaves queued/fetching. */
  private async repairFetchStatus(instrumentId: string): Promise<string> {
    const latest = await getLatestBackfillJobForInstrument(instrumentId);
    const fetchStatus = deriveFetchStatus({
      hasRun: Boolean(latest),
      queued: latest?.status === 'queued' ? 1 : 0,
      running: latest?.status === 'running' ? 1 : 0,
      lastStatus: latest?.status ?? null,
      stale: false,
    });
    await correctStalledFetchStatus(instrumentId, fetchStatus);
    return fetchStatus;
  }
}
