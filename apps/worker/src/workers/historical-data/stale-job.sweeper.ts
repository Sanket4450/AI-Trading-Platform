import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { QUEUES, queueNameOf } from '@ai-trading/domain';
import {
  listQueuedJobsOlderThan,
  resolveAbandonedQueuedJob,
} from '@ai-trading/database';
import { abandonedQueuedJobStatus } from './queued-job-state.js';

export interface RecoveredQueuedJob {
  id: string;
  jobName: string;
  instrumentId: string | null;
  createdAt: Date;
  status: 'succeeded' | 'failed';
  /** BullMQ state at sweep time; `missing` when the queue held no entry for the run. */
  queueState: string;
}

/**
 * Recovers ledger rows stuck at `queued`. Runs from `ingestion-reconcile`: a row is only closed
 * when the queue itself reports the run as gone or finished, so a long backlog stays untouched.
 */
@Injectable()
export class StaleJobSweeper {
  private readonly logger = new Logger(StaleJobSweeper.name);
  private readonly queues = new Map<string, Queue>();

  constructor(
    @InjectQueue(QUEUES.historicalData) historicalQueue: Queue,
    @InjectQueue(QUEUES.maintenance) maintenanceQueue: Queue,
  ) {
    this.queues.set(QUEUES.historicalData, historicalQueue);
    this.queues.set(QUEUES.maintenance, maintenanceQueue);
  }

  async sweepQueued(minutes: number): Promise<RecoveredQueuedJob[]> {
    const candidates = await listQueuedJobsOlderThan(minutes);
    const recovered: RecoveredQueuedJob[] = [];

    for (const candidate of candidates) {
      const queueName = queueNameOf(candidate.jobName);
      const queue = queueName ? this.queues.get(queueName) : undefined;
      if (!queue) {
        this.logger.warn(
          `Cannot check queued run ${candidate.id}: no queue for job ${candidate.jobName}`,
        );
        continue;
      }

      const job = await queue.getJob(candidate.id);
      const queueState = job ? await job.getState() : null;
      const status = abandonedQueuedJobStatus(queueState);
      if (!status) continue;

      const resolved = await resolveAbandonedQueuedJob(candidate.id, {
        status,
        queueState: queueState ?? 'missing',
      });
      if (!resolved) continue;

      recovered.push({
        id: candidate.id,
        jobName: candidate.jobName,
        instrumentId: candidate.instrumentId,
        createdAt: candidate.createdAt,
        status,
        queueState: queueState ?? 'missing',
      });
    }

    return recovered;
  }
}
