import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import {
  createJobRun,
  getProviderStatus,
  recordAudit,
  updateJobRun,
} from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import { BudgetStatusService } from './budget.service.js';

@Injectable()
export class ProviderService {
  constructor(
    private readonly config: ConfigService,
    private readonly budget: BudgetStatusService,
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
    @InjectQueue(QUEUES.maintenance) private readonly maintenanceQueue: Queue,
  ) {}

  async status() {
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
      budget,
      ...status,
    };
  }

  async enqueueReferenceJob(
    jobName: string,
    action: string,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const jobRun = await createJobRun({
      jobName,
      queueName: QUEUES.historicalData,
      jobType: 'ingestion',
      status: 'queued',
      payload: { source: 'operator' },
      correlationId: meta.requestId,
    });
    try {
      await this.historicalQueue.add(
        jobName,
        { jobRunId: jobRun.id },
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
      action,
      entityType: 'job_run',
      entityId: jobRun.id,
      beforeState: null,
      afterState: { jobName },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return jobRun;
  }

  instrumentSync(actorUserId: string, meta: RequestMeta) {
    return this.enqueueReferenceJob(
      'instrument-sync',
      'data.instrument_sync_requested',
      actorUserId,
      meta,
    );
  }

  calendarSync(actorUserId: string, meta: RequestMeta) {
    return this.enqueueReferenceJob(
      'calendar-sync',
      'data.calendar_sync_requested',
      actorUserId,
      meta,
    );
  }

  async refreshDailyStats(actorUserId: string, meta: RequestMeta) {
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
