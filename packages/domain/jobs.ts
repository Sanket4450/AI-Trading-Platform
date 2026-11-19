import { QUEUES } from './queues.js';

/** Database status vocabulary. `retrying` is gone: a retried BullMQ job returns to `queued`. */
export const JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'partially_failed',
  'cancelled',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** BullMQ state to ledger status. Documented once here and mirrored in docs/operations/job-ledger.md. */
export const BULLMQ_STATUS_MAP: Record<string, JobStatus> = {
  waiting: 'queued',
  delayed: 'queued',
  prioritized: 'queued',
  'waiting-children': 'queued',
  active: 'running',
  completed: 'succeeded',
  failed: 'failed',
};

/** Event vocabulary. `stage` says where; `type` says what happened there. */
export const JOB_EVENT_TYPES = [
  'entered',
  'progress',
  'completed',
  'failed',
  'skipped',
  'warning',
] as const;

export type JobEventType = (typeof JOB_EVENT_TYPES)[number];

export interface JobStageDefinition {
  /** Stable stage key stored on every event. */
  key: string;
  /** True when the stage reports a `completed`/`total` pair through `progress` events. */
  quantified: boolean;
}

export interface JobDefinition {
  queueName: string;
  jobType: 'ingestion' | 'maintenance';
  stages: JobStageDefinition[];
}

const stage = (key: string, quantified = false): JobStageDefinition => ({ key, quantified });

/**
 * Single source of truth for every BullMQ job. A job that is not listed here is not a queue
 * job and must not have a `job_runs` row.
 */
export const JOB_DEFINITIONS = {
  'instrument-sync': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('fetch'), stage('normalize'), stage('persist'), stage('finalize')],
  },
  'calendar-sync': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('fixture'), stage('reconcile'), stage('finalize')],
  },
  'historical-backfill': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('prepare'), stage('chunks', true), stage('finalize')],
  },
  'historical-finalize': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('prepare'), stage('repair', true), stage('refresh')],
  },
  'intraday-sync': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('prepare'), stage('instruments', true), stage('finalize')],
  },
  'coverage-recompute': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('prepare'), stage('instruments', true), stage('finalize')],
  },
  'coverage-rebuild': {
    queueName: QUEUES.historicalData,
    jobType: 'maintenance',
    stages: [stage('clear'), stage('instruments', true), stage('finalize')],
  },
  'quality-scan': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('scan', true), stage('stale'), stage('finalize')],
  },
  'ingestion-reconcile': {
    queueName: QUEUES.historicalData,
    jobType: 'ingestion',
    stages: [stage('sweep', true), stage('issues'), stage('finalize')],
  },
  'refresh-materialized-view': {
    queueName: QUEUES.maintenance,
    jobType: 'maintenance',
    stages: [stage('refresh')],
  },
  'ensure-partitions': {
    queueName: QUEUES.maintenance,
    jobType: 'maintenance',
    stages: [stage('ensure')],
  },
} as const satisfies Record<string, JobDefinition>;

export type JobName = keyof typeof JOB_DEFINITIONS;

export const JOB_NAMES = Object.keys(JOB_DEFINITIONS) as JobName[];

/** Every stage key used by any job; the database checks events against this list. */
export const JOB_STAGES = [
  ...new Set(Object.values(JOB_DEFINITIONS).flatMap((job) => job.stages.map((item) => item.key))),
] as string[];

export function isJobName(value: string): value is JobName {
  return Object.hasOwn(JOB_DEFINITIONS, value);
}

export function jobDefinition(jobName: string): JobDefinition | null {
  return isJobName(jobName) ? JOB_DEFINITIONS[jobName] : null;
}

export function stagesForJob(jobName: string): string[] {
  return jobDefinition(jobName)?.stages.map((item) => item.key) ?? [];
}

export function jobTypeOf(jobName: string): string | null {
  return jobDefinition(jobName)?.jobType ?? null;
}

export function queueNameOf(jobName: string): string | null {
  return jobDefinition(jobName)?.queueName ?? null;
}

export function isQuantifiedStage(jobName: string, stageKey: string): boolean {
  return jobDefinition(jobName)?.stages.some((item) => item.key === stageKey && item.quantified) ?? false;
}

/** Redis channel the worker publishes to and the API gateway subscribes to. */
export const JOB_EVENTS_CHANNEL = 'ai-trading:job-events';

export interface JobRunBroadcast {
  id: string;
  jobName: string;
  queueName: string;
  status: string;
  groupId: string | null;
  instrumentId: string | null;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
}

export interface JobEventBroadcast {
  id: number;
  jobRunId: string;
  stage: string;
  type: JobEventType;
  occurredAt: string;
  data: Record<string, unknown>;
}

export type JobBroadcast =
  | { type: 'run'; run: JobRunBroadcast }
  | { type: 'event'; event: JobEventBroadcast };
