import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import {
  createJobRun,
  getCatalogSummary,
  getCoverageDayDetail,
  getInstrumentStatusDetail,
  listUniverseCatalog,
  recordAudit,
  updateJobRun,
} from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type {
  InstrumentCoverageQueryDto,
  RecomputeInstrumentCoverageDto,
} from './dto/instrument-coverage-query.dto.js';

@Injectable()
export class InstrumentCoverageService {
  constructor(
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
  ) {}

  list(query: InstrumentCoverageQueryDto) {
    return listUniverseCatalog({
      universeCode: query.universeCode,
      fetchStatus: query.fetchStatus,
      dataStatus: query.dataStatus,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  summary(universeCode?: string) {
    return getCatalogSummary(universeCode);
  }

  async detail(instrumentId: string) {
    const detail = await getInstrumentStatusDetail(instrumentId);
    if (!detail) throw new NotFoundException('Instrument not found');
    return detail;
  }

  coverageDay(instrumentId: string, date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    return getCoverageDayDetail(instrumentId, date);
  }

  async recompute(
    instrumentId: string,
    body: RecomputeInstrumentCoverageDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const jobRun = await createJobRun({
      jobName: 'coverage-recompute',
      queueName: QUEUES.historicalData,
      jobType: 'ingestion',
      status: 'queued',
      payload: {
        instrumentIds: [instrumentId],
        from: body.from ?? '2022-01-01',
        to: body.to,
      },
      correlationId: meta.requestId,
    });
    try {
      await this.historicalQueue.add(
        'coverage-recompute',
        {
          jobRunId: jobRun.id,
          instrumentIds: [instrumentId],
          from: body.from ?? '2022-01-01',
          to: body.to,
        },
        {
          jobId: jobRun.id,
          priority: 5,
          attempts: 2,
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
      action: 'data.instrument_status_recomputed',
      entityType: 'job_run',
      entityId: jobRun.id,
      beforeState: null,
      afterState: { instrumentId, from: body.from, to: body.to },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return jobRun;
  }
}
