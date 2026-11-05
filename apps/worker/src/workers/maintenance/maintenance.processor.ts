import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import {
  ensureMarketPartitions,
  refreshDailyStats,
  updateJobRun,
} from '@ai-trading/database';
import { ProcessTrackingService } from '../../observability/process-tracking.service.js';

@Processor(QUEUES.maintenance)
export class MaintenanceProcessor extends WorkerHost {
  constructor(private readonly tracking: ProcessTrackingService) {
    super();
  }

  process(job: Job): Promise<unknown> {
    return this.tracking.run(job, () => this.execute(job));
  }

  private async execute(job: Job): Promise<unknown> {
    const jobRunId = String((job.data as Record<string, unknown>).jobRunId);
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });

    try {
      let result: Record<string, unknown>;
      if (job.name === 'refresh-materialized-view') {
        await refreshDailyStats();
        result = { refreshed: true };
      } else if (job.name === 'ensure-partitions') {
        await ensureMarketPartitions(6);
        result = { partitionsEnsured: true };
      } else {
        throw new Error(`Unknown maintenance job: ${job.name}`);
      }

      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      return result;
    } catch (error) {
      await updateJobRun(jobRunId, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Maintenance job failed',
      });
      throw error;
    }
  }
}
