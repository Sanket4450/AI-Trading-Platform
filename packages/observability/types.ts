export type JobEventKind = 'lifecycle' | 'stage' | 'step' | 'metric' | 'warning' | 'error';

export type JobEventLevel = 'debug' | 'info' | 'warn' | 'error';

export type JobStageStatus = 'succeeded' | 'failed' | 'skipped';

export interface JobEventInput {
  jobRunId: string;
  kind: JobEventKind;
  level?: JobEventLevel;
  stageKey?: string | null;
  message?: string | null;
  data?: Record<string, unknown>;
  metricKey?: string | null;
  metricValue?: number | null;
  metricUnit?: string | null;
  occurredAt?: Date;
}

export interface JobBeginInput {
  jobRunId: string;
  stages: string[];
  startedAt?: Date;
}

export interface JobFinishInput {
  status: 'succeeded' | 'failed';
  summary?: string | null;
  error?: unknown;
}

export interface JobStore {
  beginRun(input: { jobRunId: string; stages: string[]; startedAt: Date }): Promise<void>;
  setStage(input: { jobRunId: string; stageKey: string }): Promise<void>;
  finishRun(input: {
    jobRunId: string;
    status: 'succeeded' | 'failed';
    currentStage: string | null;
    durationMs: number | null;
    summary?: string | null;
    errorMessage?: string | null;
  }): Promise<void>;
  appendEvents(events: JobEventInput[]): Promise<void>;
}

export interface JobTrackerOptions {
  flushMs?: number;
  maxBuffer?: number;
  onError?: (error: unknown) => void;
}
