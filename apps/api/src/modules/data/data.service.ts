import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import {
  createJobRun,
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
  CoverageQueryDto,
  DailyStatsQueryDto,
  IngestionRunsQueryDto,
  QualityIssuesQueryDto,
} from './dto/data-query.dto.js';

@Injectable()
export class DataService {
  constructor(
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
