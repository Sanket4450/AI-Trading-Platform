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
  createJobRun,
  findProviderByCode,
  getCoverageSummary,
  getDailyStats,
  listCoverage,
  listIngestionRuns,
  listQualityIssues,
  recordAudit,
  updateJobRun,
  updateQualityIssueStatus,
} from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type {
  AcknowledgeIssueDto,
  BackfillDto,
  CoverageQueryDto,
  DailyStatsQueryDto,
  IngestionRunsQueryDto,
  QualityIssuesQueryDto,
} from './dto/data-query.dto.js';

const DATA_START = '2022-01-01';

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

@Injectable()
export class DataService {
  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
    @InjectQueue(QUEUES.maintenance) private readonly maintenanceQueue: Queue,
  ) {}

  coverage(query: CoverageQueryDto) {
    return listCoverage(query);
  }

  coverageSummary(date?: string) {
    return getCoverageSummary(date);
  }

  ingestionRuns(query: IngestionRunsQueryDto) {
    return listIngestionRuns(query);
  }

  qualityIssues(query: QualityIssuesQueryDto) {
    return listQualityIssues(query);
  }

  dailyStats(query: DailyStatsQueryDto) {
    return getDailyStats(query);
  }

  async acknowledgeIssue(
    id: string,
    body: AcknowledgeIssueDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const updated = await updateQualityIssueStatus(id, body.status);
    if (!updated) throw new NotFoundException('Quality issue not found');

    await recordAudit({
      actorUserId,
      accountId: null,
      action: `data_quality_issue.${body.status}`,
      entityType: 'data_quality_issue',
      entityId: id,
      beforeState: null,
      afterState: { status: body.status },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async backfill(body: BackfillDto, actorUserId: string, meta: RequestMeta) {
    if (body.from < DATA_START) {
      throw new BadRequestException(
        `Backfill cannot start before ${DATA_START}`,
      );
    }
    const today = istToday();
    if (body.to > today) {
      throw new BadRequestException('Backfill cannot end after today');
    }
    if (body.to < body.from) {
      throw new BadRequestException('to must be on or after from');
    }

    const maxDays = this.config.get<number>('DATA_BACKFILL_MAX_DAYS', 31);
    if (daysBetween(body.from, body.to) > maxDays) {
      throw new BadRequestException(
        `A single backfill is limited to ${maxDays} days`,
      );
    }

    const provider = await findProviderByCode('upstox');
    if (!provider) {
      throw new ServiceUnavailableException('Upstox provider is not seeded');
    }

    const jobRun = await createJobRun({
      jobName: 'historical_backfill',
      queueName: QUEUES.historicalData,
      jobType: 'ingestion',
      status: 'queued',
      payload: {
        instrumentId: body.instrumentId,
        from: body.from,
        to: body.to,
        providerId: provider.id,
      },
      correlationId: meta.requestId,
    });

    try {
      await this.historicalQueue.add(
        'historical-backfill',
        {
          jobRunId: jobRun.id,
          instrumentId: body.instrumentId,
          from: body.from,
          to: body.to,
          providerId: provider.id,
        },
        {
          jobId: jobRun.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      );
    } catch (error) {
      await updateJobRun(jobRun.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Queue unavailable',
      });
      throw new ServiceUnavailableException(
        'The background queue is unavailable',
      );
    }

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.backfill_requested',
      entityType: 'job_run',
      entityId: jobRun.id,
      beforeState: null,
      afterState: {
        instrumentId: body.instrumentId,
        from: body.from,
        to: body.to,
        provider: provider.code,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return jobRun;
  }

  async refreshMaterializedView(actorUserId: string, meta: RequestMeta) {
    const jobRun = await createJobRun({
      jobName: 'refresh_materialized_view',
      queueName: QUEUES.maintenance,
      jobType: 'maintenance',
      status: 'queued',
      payload: {},
      correlationId: meta.requestId,
    });

    try {
      await this.maintenanceQueue.add(
        'refresh-materialized-view',
        { jobRunId: jobRun.id },
        {
          jobId: jobRun.id,
          attempts: 2,
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    } catch (error) {
      await updateJobRun(jobRun.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Queue unavailable',
      });
      throw new ServiceUnavailableException(
        'The background queue is unavailable',
      );
    }

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.materialized_view_refresh_requested',
      entityType: 'job_run',
      entityId: jobRun.id,
      beforeState: null,
      afterState: {},
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return jobRun;
  }
}
