import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ProcessTracker } from '@ai-trading/observability';
import { processStore } from './process-store.js';
import { isInstrumentedJob, stagesForJob } from './process-stages.js';

type TrackedJob = Pick<Job, 'name' | 'data' | 'attemptsMade'>;

function jobRunIdOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as Record<string, unknown>).jobRunId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Owns the process journal for worker jobs. The processor wrapper starts and
 * closes every run; services may add domain stages, steps and metrics.
 */
@Injectable()
export class ProcessTrackingService implements OnModuleDestroy {
  private readonly logger = new Logger(ProcessTrackingService.name);
  private readonly tracker = new ProcessTracker(processStore, {
    onError: (error) =>
      this.logger.warn(
        `Process tracking degraded: ${error instanceof Error ? error.message : String(error)}`,
      ),
  });

  async run<T>(job: TrackedJob, handler: () => Promise<T>): Promise<T> {
    const jobRunId = jobRunIdOf(job.data);
    if (!jobRunId) return handler();

    const instrumented = isInstrumentedJob(job.name);
    await this.tracker.begin({ jobRunId, stages: stagesForJob(job.name) });

    if (!instrumented) {
      this.tracker.enterStage(jobRunId, 'start');
      this.tracker.completeStage(jobRunId, 'start');
      this.tracker.enterStage(jobRunId, 'work');
    }

    try {
      const result = await handler();
      if (!instrumented) {
        this.tracker.completeStage(jobRunId, 'work');
        this.tracker.enterStage(jobRunId, 'finish');
        this.tracker.completeStage(jobRunId, 'finish');
      }
      await this.tracker.finish(jobRunId, { status: 'succeeded' });
      return result;
    } catch (error) {
      if (!instrumented) this.tracker.completeStage(jobRunId, 'work', 'failed');
      await this.tracker.finish(jobRunId, { status: 'failed', error });
      throw error;
    }
  }

  enterStage(jobRunId: string, key: string, message?: string): void {
    this.tracker.enterStage(jobRunId, key, message);
  }

  completeStage(
    jobRunId: string,
    key: string,
    status: 'succeeded' | 'failed' | 'skipped' = 'succeeded',
    message?: string,
  ): void {
    this.tracker.completeStage(jobRunId, key, status, message);
  }

  step(
    jobRunId: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.tracker.step(jobRunId, message, data);
  }

  metric(jobRunId: string, key: string, value: number, unit = 'count'): void {
    this.tracker.metric(jobRunId, key, value, unit);
  }

  warn(
    jobRunId: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.tracker.warn(jobRunId, message, data);
  }

  async onModuleDestroy(): Promise<void> {
    await this.tracker.flushAll();
  }
}
