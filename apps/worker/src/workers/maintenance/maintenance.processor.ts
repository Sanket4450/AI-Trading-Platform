import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import {
  deleteExternalApiCallsBefore,
  ensureMarketPartitions,
  refreshDailyStats,
  updateJobRun,
} from '@ai-trading/database';
import { JobTrackingService } from '../../observability/job-tracking.service.js';

/** The API call ledger is a debugging surface, not an archive. */
const API_CALL_RETENTION_DAYS = 90;

@Processor(QUEUES.maintenance)
export class MaintenanceProcessor extends WorkerHost {
  constructor(private readonly tracking: JobTrackingService) {
    super();
  }

  process(job: Job): Promise<unknown> {
    return this.tracking.run(job, () => this.execute(job));
  }

  private async execute(job: Job): Promise<unknown> {
    const jobRunId = String((job.data as Record<string, unknown>).jobRunId);
    const stage = job.name === 'ensure-partitions' ? 'ensure' : 'refresh';
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
    });

    try {
      let result: Record<string, unknown>;
      if (job.name === 'refresh-materialized-view') {
        await refreshDailyStats();
        result = { refreshed: true };
      } else if (job.name === 'ensure-partitions') {
        await ensureMarketPartitions(6);
        const apiCallsPurged = await deleteExternalApiCallsBefore(
          new Date(Date.now() - API_CALL_RETENTION_DAYS * 86_400_000),
        );
        result = { partitionsEnsured: true, apiCallsPurged };
      } else {
        throw new Error(`Unknown maintenance job: ${job.name}`);
      }

      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      this.tracking.completeStage(jobRunId, stage, 'completed', result);
      return result;
    } catch (error) {
      await updateJobRun(jobRunId, {
        status: 'failed',
        finishedAt: new Date(),
        error: {
          code: 'maintenance_failed',
          message:
            error instanceof Error ? error.message : 'Maintenance job failed',
          retryable: false,
        },
      });
      throw error;
    }
  }
}
