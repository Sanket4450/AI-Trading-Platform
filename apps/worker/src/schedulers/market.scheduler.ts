import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import { createJobRun, updateJobRun } from '@ai-trading/database';

@Injectable()
export class MarketScheduler {
  private readonly logger = new Logger(MarketScheduler.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
    @InjectQueue(QUEUES.maintenance) private readonly maintenanceQueue: Queue,
  ) {}

  private get enabled(): boolean {
    return (
      this.config.get<boolean | string>('WORKER_SCHEDULES_ENABLED', true) ===
        true || this.config.get<string>('WORKER_SCHEDULES_ENABLED') === 'true'
    );
  }

  @Cron('0 8 * * 1-5', { timeZone: 'Asia/Kolkata' })
  async preMarketInstrumentSync(): Promise<void> {
    if (!this.enabled) return;
    await this.enqueue(this.historicalQueue, 'instrument-sync', 'ingestion', {
      source: 'schedule',
    });
  }

  @Cron('0 8 * * 1-5', { timeZone: 'Asia/Kolkata' })
  async preMarketCalendarSync(): Promise<void> {
    if (!this.enabled) return;
    await this.enqueue(this.historicalQueue, 'calendar-sync', 'ingestion', {
      source: 'schedule',
    });
  }

  @Cron('0 16 * * 1-5', { timeZone: 'Asia/Kolkata' })
  async postMarketRefresh(): Promise<void> {
    if (!this.enabled) return;
    await this.enqueue(
      this.maintenanceQueue,
      'refresh-materialized-view',
      'maintenance',
      {
        source: 'schedule',
      },
    );
  }

  @Cron('0 8 1 * *', { timeZone: 'Asia/Kolkata' })
  async monthlyPartitionMaintenance(): Promise<void> {
    if (!this.enabled) return;
    await this.enqueue(
      this.maintenanceQueue,
      'ensure-partitions',
      'maintenance',
      {
        source: 'schedule',
      },
    );
  }

  private async enqueue(
    queue: Queue,
    jobName: string,
    jobType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const jobRun = await createJobRun({
      jobName,
      queueName: queue.name,
      jobType,
      status: 'queued',
      payload,
    });

    try {
      await queue.add(
        jobName,
        { ...payload, jobRunId: jobRun.id },
        {
          jobId: jobRun.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      );
      this.logger.log(`Queued scheduled job ${jobName} (${jobRun.id})`);
    } catch (error) {
      await updateJobRun(jobRun.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Queue unavailable',
      });
      this.logger.error(`Failed to queue ${jobName}: ${String(error)}`);
    }
  }
}
