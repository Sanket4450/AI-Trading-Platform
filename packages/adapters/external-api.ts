import type { ExternalApiOutcome, ExternalApiScope } from '@ai-trading/domain';

/** One finished network attempt, produced by a client and consumed by the runtime recorder. */
export interface ExternalApiCallEvent {
  jobRunId: string | null;
  service: string;
  operation: string;
  instrumentId: string | null;
  startedAt: Date;
  latencyMs: number;
  statusCode: number | null;
  outcome: ExternalApiOutcome;
  requestScope: ExternalApiScope;
  errorBody: string | null;
}

/**
 * Sink for finished calls. The implementation buffers and owns persistence, so a client never
 * depends on the database and a failing sink can never fail the request.
 */
export interface ExternalApiCallSink {
  record(call: ExternalApiCallEvent): void;
}

export interface ExternalApiCallContext {
  jobRunId?: string | null;
  instrumentId?: string | null;
}
