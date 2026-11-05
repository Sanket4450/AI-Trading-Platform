export type ProcessEventKind = 'lifecycle' | 'stage' | 'step' | 'metric' | 'warning' | 'error';

export type ProcessEventLevel = 'debug' | 'info' | 'warn' | 'error';

export type ProcessStageStatus = 'succeeded' | 'failed' | 'skipped';

export interface ProcessEventInput {
  jobRunId: string;
  kind: ProcessEventKind;
  level?: ProcessEventLevel;
  stageKey?: string | null;
  message?: string | null;
  data?: Record<string, unknown>;
  metricKey?: string | null;
  metricValue?: number | null;
  metricUnit?: string | null;
  occurredAt?: Date;
}

export interface ProcessBeginInput {
  jobRunId: string;
  stages: string[];
  startedAt?: Date;
}

export interface ProcessFinishInput {
  status: 'succeeded' | 'failed';
  summary?: string | null;
  error?: unknown;
}

export interface ProcessStore {
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
  appendEvents(events: ProcessEventInput[]): Promise<void>;
}

export interface ProcessTrackerOptions {
  flushMs?: number;
  maxBuffer?: number;
  onError?: (error: unknown) => void;
}
