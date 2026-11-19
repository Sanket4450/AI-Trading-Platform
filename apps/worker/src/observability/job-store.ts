import { Injectable } from '@nestjs/common';
import type {
  JobBroadcast,
  JobEventBroadcast,
  JobRunBroadcast,
} from '@ai-trading/domain';
import {
  appendJobRunEvents,
  beginJobRunTracking,
  finishJobRunTracking,
} from '@ai-trading/database';
import type { JobStore } from '@ai-trading/observability';
import { JobEventsPublisher } from './job-events.publisher.js';

function runBroadcast(row: {
  id: string;
  jobName: string;
  queueName: string;
  status: string;
  groupId: string | null;
  instrumentId: string | null;
  attempt: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  result: unknown;
  error: unknown;
}): JobRunBroadcast {
  return {
    id: row.id,
    jobName: row.jobName,
    queueName: row.queueName,
    status: row.status,
    groupId: row.groupId,
    instrumentId: row.instrumentId,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    result: (row.result as Record<string, unknown> | null) ?? null,
    error: (row.error as Record<string, unknown> | null) ?? null,
  };
}

function eventBroadcast(row: {
  id: number;
  jobRunId: string;
  stage: string;
  type: string;
  occurredAt: Date;
  data: unknown;
}): JobEventBroadcast {
  return {
    id: row.id,
    jobRunId: row.jobRunId,
    stage: row.stage,
    type: row.type as JobEventBroadcast['type'],
    occurredAt: row.occurredAt.toISOString(),
    data: (row.data as Record<string, unknown> | null) ?? {},
  };
}

/** Bridges the framework-free tracker to Drizzle and the realtime channel. */
@Injectable()
export class JobStoreService implements JobStore {
  constructor(private readonly publisher: JobEventsPublisher) {}

  async beginRun(input: Parameters<JobStore['beginRun']>[0]): Promise<void> {
    const row = await beginJobRunTracking(input);
    if (row) this.publish({ type: 'run', run: runBroadcast(row) });
  }

  async finishRun(input: Parameters<JobStore['finishRun']>[0]): Promise<void> {
    const row = await finishJobRunTracking(input);
    if (row) this.publish({ type: 'run', run: runBroadcast(row) });
  }

  async appendEvents(input: Parameters<JobStore['appendEvents']>[0]): Promise<void> {
    const rows = await appendJobRunEvents(input);
    for (const row of rows) {
      this.publish({ type: 'event', event: eventBroadcast(row) });
    }
  }

  private publish(message: JobBroadcast): void {
    this.publisher.publish(message);
  }
}
