import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { stagesForJob } from '@ai-trading/domain';
import { JobTracker, type JobStageOutcome } from '@ai-trading/observability';
import { JobStoreService } from './job-store.js';

type TrackedJob = Pick<Job, 'name' | 'data' | 'attemptsMade'>;

function jobRunIdOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as Record<string, unknown>).jobRunId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Owns the job journal for worker jobs. The processor wrapper starts and closes every run;
 * services record the stage transitions and figures that belong to their job.
 */
@Injectable()
export class JobTrackingService implements OnModuleDestroy {
  private readonly logger = new Logger(JobTrackingService.name);
  private readonly tracker: JobTracker;

  constructor(store: JobStoreService) {
    this.tracker = new JobTracker(store, {
      onError: (error) =>
        this.logger.warn(
          `Job tracking degraded: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });
  }

  async run<T>(job: TrackedJob, handler: () => Promise<T>): Promise<T> {
    const jobRunId = jobRunIdOf(job.data);
    const stages = stagesForJob(job.name);
    if (!jobRunId || stages.length === 0) return handler();

    await this.tracker.begin({
      jobRunId,
      stages,
      attempt: job.attemptsMade ?? 0,
    });

    try {
      const result = await handler();
      await this.tracker.finish(jobRunId, { status: 'succeeded' });
      return result;
    } catch (error) {
      await this.tracker.finish(jobRunId, { status: 'failed', error });
      throw error;
    }
  }

  enterStage(jobRunId: string, stage: string): void {
    this.tracker.enterStage(jobRunId, stage);
  }

  /** Records one unit of work inside a quantified stage. */
  progress(jobRunId: string, stage: string, data: Record<string, unknown>): void {
    this.tracker.progress(jobRunId, stage, data);
  }

  completeStage(
    jobRunId: string,
    stage: string,
    outcome: JobStageOutcome = 'completed',
    data?: Record<string, unknown>,
  ): void {
    this.tracker.completeStage(jobRunId, stage, outcome, data);
  }

  warning(jobRunId: string, stage: string, data: Record<string, unknown>): void {
    this.tracker.warning(jobRunId, stage, data);
  }

  async onModuleDestroy(): Promise<void> {
    await this.tracker.flushAll();
  }
}
