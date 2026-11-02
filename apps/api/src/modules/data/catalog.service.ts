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
import { QUALITY_RULES } from '@ai-trading/market-data';
import {
  createJobRun,
  getCatalogSummary,
  getCoverageDayDetail,
  getCoverageHeatmap,
  getIngestionRunDetail,
  getInstrumentStatusDetail,
  getProviderStatus,
  getQualityIssue,
  getUniverseMembersForBackfill,
  listDailyValidation,
  listUniverseCatalog,
  recordAudit,
  transitionQualityIssue,
  updateJobRun,
} from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import { BudgetStatusService } from './budget.service.js';
import type {
  CoverageHeatmapQueryDto,
  InstrumentStatusQueryDto,
  QualityIssueActionDto,
  RecomputeStatusDto,
  ValidationQueryDto,
} from './dto/r2-data.dto.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly config: ConfigService,
    private readonly budget: BudgetStatusService,
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
  ) {}

  instrumentStatus(query: InstrumentStatusQueryDto) {
    return listUniverseCatalog({
      universeCode: query.universeCode,
      fetchStatus: query.fetchStatus,
      dataStatus: query.dataStatus,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async instrumentStatusDetail(instrumentId: string) {
    const detail = await getInstrumentStatusDetail(instrumentId);
    if (!detail) throw new NotFoundException('Instrument not found');
    return detail;
  }

  catalogSummary(universeCode?: string) {
    return getCatalogSummary(universeCode);
  }

  coverageHeatmap(query: CoverageHeatmapQueryDto) {
    const days =
      Math.floor(
        (new Date(`${query.to}T00:00:00Z`).getTime() -
          new Date(`${query.from}T00:00:00Z`).getTime()) /
          86_400_000,
      ) + 1;
    if (days < 1 || days > 370) {
      throw new BadRequestException(
        'Coverage heatmap range must be between 1 and 370 days',
      );
    }
    return getCoverageHeatmap(query);
  }

  coverageDayDetail(instrumentId: string, date: string) {
    return getCoverageDayDetail(instrumentId, date);
  }

  validation(query: ValidationQueryDto) {
    return listDailyValidation(query);
  }

  async runDetail(id: string) {
    const detail = await getIngestionRunDetail(id);
    if (!detail) throw new NotFoundException('Ingestion run not found');
    return detail;
  }

  async issueDetail(id: string) {
    const issue = await getQualityIssue(id);
    if (!issue) throw new NotFoundException('Quality issue not found');
    return issue;
  }

  qualityRules() {
    return QUALITY_RULES;
  }

  async providerStatus() {
    const [status, budget] = await Promise.all([
      getProviderStatus(),
      this.budget.state(),
    ]);
    return {
      provider: 'upstox',
      networkEnabled:
        this.config.get<boolean | string>('UPSTOX_NETWORK_ENABLED', true) ===
          true || this.config.get<string>('UPSTOX_NETWORK_ENABLED') === 'true',
      apiKeyConfigured: Boolean(this.config.get<string>('UPSTOX_API_KEY')),
      tokenConfigured: Boolean(this.config.get<string>('UPSTOX_ACCESS_TOKEN')),
      baseUrl: this.config.get<string>(
        'UPSTOX_BASE_URL',
        'https://api.upstox.com',
      ),
      dailyOracleEnabled:
        this.config.get<boolean | string>(
          'DATA_VALIDATION_DAILY_ORACLE',
          true,
        ) === true ||
        this.config.get<string>('DATA_VALIDATION_DAILY_ORACLE') === 'true',
      budget,
      ...status,
    };
  }

  async acknowledgeIssue(
    id: string,
    body: QualityIssueActionDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    let updated;
    try {
      updated = await transitionQualityIssue({
        id,
        status: body.status,
        note: body.note ?? null,
        actorUserId,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid issue transition',
      );
    }
    if (!updated) throw new NotFoundException('Quality issue not found');
    await recordAudit({
      actorUserId,
      accountId: null,
      action: `data_quality_issue.${body.status}`,
      entityType: 'data_quality_issue',
      entityId: id,
      beforeState: null,
      afterState: { status: body.status, note: body.note ?? null },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  async recomputeStatus(
    body: RecomputeStatusDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const instrumentIds =
      body.instrumentIds && body.instrumentIds.length > 0
        ? body.instrumentIds
        : (
            await getUniverseMembersForBackfill(body.universeCode ?? 'nifty-50')
          ).map((member) => member.instrumentId);
    const jobRun = await createJobRun({
      jobName: 'coverage-recompute',
      queueName: QUEUES.historicalData,
      jobType: 'ingestion',
      status: 'queued',
      payload: {
        instrumentIds,
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
          instrumentIds,
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
      afterState: {
        instrumentIds: instrumentIds.length,
        from: body.from,
        to: body.to,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return jobRun;
  }
}
