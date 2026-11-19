export type JobEventType = 'entered' | 'progress' | 'completed' | 'failed' | 'skipped' | 'warning';

export type JobStageOutcome = 'completed' | 'failed' | 'skipped';

export interface JobError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface JobEventInput {
  jobRunId: string;
  /** Fixed stage key from the job catalog. */
  stage: string;
  /** What happened at that stage. */
  type: JobEventType;
  /** Stage figures. Never prose. */
  data?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface JobBeginInput {
  jobRunId: string;
  /** Ordered stages from the job catalog. The first one is entered immediately. */
  stages: string[];
  startedAt?: Date;
  /** BullMQ attempt number; a retry resets the run to running. */
  attempt?: number;
}

export interface JobFinishInput {
  status: 'succeeded' | 'failed';
  error?: unknown;
}

export interface JobStore {
  beginRun(input: { jobRunId: string; startedAt: Date; attempt: number }): Promise<void>;
  finishRun(input: {
    jobRunId: string;
    status: 'succeeded' | 'failed';
    error?: JobError | null;
  }): Promise<void>;
  appendEvents(events: JobEventInput[]): Promise<void>;
}

export interface JobTrackerOptions {
  flushMs?: number;
  maxBuffer?: number;
  onError?: (error: unknown) => void;
}

/** Normalizes a thrown value into the structured error stored on the run. */
export function toJobError(error: unknown): JobError {
  if (error && typeof error === 'object' && 'message' in error) {
    const candidate = error as { code?: unknown; message?: unknown; retryable?: unknown };
    if (typeof candidate.message === 'string') {
      return {
        code: typeof candidate.code === 'string' ? candidate.code : 'job_failed',
        message: candidate.message,
        retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : undefined,
      };
    }
  }
  if (typeof error === 'string' && error.length > 0) {
    return { code: 'job_failed', message: error };
  }
  return { code: 'job_failed', message: 'Job failed' };
}
