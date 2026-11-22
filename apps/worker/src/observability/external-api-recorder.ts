import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { ExternalApiCallEvent, ExternalApiCallSink } from '@ai-trading/adapters';
import { readExternalApiScope, type ApiCallBroadcast } from '@ai-trading/domain';
import { insertExternalApiCalls } from '@ai-trading/database';
import { JobEventsPublisher } from './job-events.publisher.js';

const FLUSH_MS = 250;
const MAX_BATCH = 100;
/** Hard ceiling so a stalled database cannot grow the buffer without bound. */
const MAX_BUFFER = 1_000;

function broadcast(row: {
  id: number;
  jobRunId: string | null;
  instrumentId: string | null;
  startedAt: Date;
  latencyMs: number;
  service: string;
  operation: string;
  requestScope: unknown;
  statusCode: number | null;
  outcome: string;
  errorBody: string | null;
}): ApiCallBroadcast {
  return {
    id: row.id,
    jobRunId: row.jobRunId,
    startedAt: row.startedAt.toISOString(),
    latencyMs: row.latencyMs,
    service: row.service,
    operation: row.operation,
    instrumentId: row.instrumentId,
    requestScope: readExternalApiScope(row.requestScope),
    statusCode: row.statusCode,
    outcome: row.outcome as ApiCallBroadcast['outcome'],
    errorBody: row.errorBody,
  };
}

/**
 * Buffers provider calls and writes them in batches, then fans the inserted rows out to the
 * dashboard. Losing a buffered row is acceptable; slowing down or failing an ingestion request
 * is not.
 */
@Injectable()
export class ExternalApiRecorder implements ExternalApiCallSink, OnModuleDestroy {
  private readonly logger = new Logger(ExternalApiRecorder.name);
  private buffer: ExternalApiCallEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private dropping = false;
  private dropped = 0;

  constructor(private readonly publisher: JobEventsPublisher) {}

  record(call: ExternalApiCallEvent): void {
    if (this.buffer.length >= MAX_BUFFER) {
      this.dropped += 1;
      if (!this.dropping) {
        this.dropping = true;
        this.logger.warn('External API call buffer is full; dropping records');
      }
      return;
    }

    this.buffer.push(call);
    if (this.buffer.length >= MAX_BATCH) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_MS);
      this.timer.unref();
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return;

    const batch = this.buffer;
    this.buffer = [];

    try {
      const rows = await insertExternalApiCalls(batch);
      if (rows.length > 0) {
        this.publisher.publish({ type: 'calls', calls: rows.map(broadcast) });
      }
    } catch (error) {
      this.dropped += batch.length;
      this.logger.warn(
        `External API call batch dropped (${batch.length}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (this.buffer.length >= MAX_BATCH) void this.flush();
  }

  async onModuleDestroy(): Promise<void> {
    await this.flush();
    if (this.dropped > 0) {
      this.logger.warn(`External API ledger dropped ${this.dropped} record(s) this run`);
    }
  }
}
