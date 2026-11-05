import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { jobRunEvents, jobRuns } from '../schema/index.js';

export interface ProcessEventRecord {
  jobRunId: string;
  kind: 'lifecycle' | 'stage' | 'step' | 'metric' | 'warning' | 'error';
  level?: 'debug' | 'info' | 'warn' | 'error';
  stageKey?: string | null;
  message?: string | null;
  data?: Record<string, unknown>;
  metricKey?: string | null;
  metricValue?: number | null;
  metricUnit?: string | null;
  occurredAt?: Date;
}

/** Creates the stage metadata without disturbing an existing terminal status. */
export async function beginJobRunTracking(input: {
  jobRunId: string;
  stages: string[];
  startedAt: Date;
}): Promise<void> {
  await db
    .update(jobRuns)
    .set({
      startedAt: sql`coalesce(${jobRuns.startedAt}, ${input.startedAt})`,
      status: sql`case when ${jobRuns.status} in ('queued', 'retrying') then 'running' else ${jobRuns.status} end`,
      stageKeys: input.stages,
      stageTotal: input.stages.length,
      currentStage: input.stages[0] ?? null,
      durationMs: null,
    })
    .where(eq(jobRuns.id, input.jobRunId));
}

export async function setJobRunStage(input: { jobRunId: string; stageKey: string }): Promise<void> {
  await db
    .update(jobRuns)
    .set({ currentStage: input.stageKey })
    .where(eq(jobRuns.id, input.jobRunId));
}

/** Closes the run only when the owning service has not already reached a terminal status. */
export async function finishJobRunTracking(input: {
  jobRunId: string;
  status: 'succeeded' | 'failed';
  currentStage?: string | null;
  durationMs: number | null;
  summary?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  await db
    .update(jobRuns)
    .set({
      status: sql`case when ${jobRuns.status} in ('queued', 'running', 'retrying') then ${input.status} else ${jobRuns.status} end`,
      finishedAt: sql`coalesce(${jobRuns.finishedAt}, now())`,
      durationMs: sql`coalesce(${jobRuns.durationMs}, ${input.durationMs})`,
      currentStage: sql`coalesce(${input.currentStage ?? null}, ${jobRuns.currentStage})`,
      summary: sql`coalesce(${input.summary ?? null}, ${jobRuns.summary})`,
      errorMessage: sql`coalesce(${input.errorMessage ?? null}, ${jobRuns.errorMessage})`,
    })
    .where(eq(jobRuns.id, input.jobRunId));
}

export async function appendJobRunEvents(events: ProcessEventRecord[]): Promise<void> {
  if (events.length === 0) return;

  await db.insert(jobRunEvents).values(
    events.map((event) => ({
      jobRunId: event.jobRunId,
      kind: event.kind,
      level: event.level ?? 'info',
      stageKey: event.stageKey ?? null,
      message: event.message ?? null,
      data: event.data ?? {},
      metricKey: event.metricKey ?? null,
      metricValue:
        event.metricValue === null || event.metricValue === undefined
          ? null
          : String(event.metricValue),
      metricUnit: event.metricUnit ?? null,
      occurredAt: event.occurredAt ?? new Date(),
    })),
  );
}

export async function listProcessRuns(filters: {
  limit: number;
  status?: string;
  jobType?: string;
}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(jobRuns.status, filters.status));
  if (filters.jobType) conditions.push(eq(jobRuns.jobType, filters.jobType));

  return db
    .select({
      id: jobRuns.id,
      jobName: jobRuns.jobName,
      queueName: jobRuns.queueName,
      jobType: jobRuns.jobType,
      status: jobRuns.status,
      currentStage: jobRuns.currentStage,
      stageKeys: jobRuns.stageKeys,
      stageTotal: jobRuns.stageTotal,
      scheduledFor: jobRuns.scheduledFor,
      startedAt: jobRuns.startedAt,
      finishedAt: jobRuns.finishedAt,
      attempt: jobRuns.attempt,
      maxAttempts: jobRuns.maxAttempts,
      durationMs: jobRuns.durationMs,
      summary: jobRuns.summary,
      errorMessage: jobRuns.errorMessage,
      correlationId: jobRuns.correlationId,
      createdAt: jobRuns.createdAt,
    })
    .from(jobRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobRuns.createdAt))
    .limit(filters.limit);
}

export async function getProcessRun(id: string) {
  const rows = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Returns the newest events in chronological order so the timeline reads top to bottom. */
export async function getProcessEvents(jobRunId: string, limit: number) {
  const rows = await db
    .select()
    .from(jobRunEvents)
    .where(eq(jobRunEvents.jobRunId, jobRunId))
    .orderBy(desc(jobRunEvents.id))
    .limit(limit);
  return rows.reverse();
}

export async function getProcessSummary() {
  const [row] = await db
    .select({
      running: sql<number>`count(*) filter (where ${jobRuns.status} = 'running')::int`,
      failed24h: sql<number>`count(*) filter (where ${jobRuns.status} = 'failed' and ${jobRuns.createdAt} >= now() - interval '24 hours')::int`,
      succeeded24h: sql<number>`count(*) filter (where ${jobRuns.status} = 'succeeded' and ${jobRuns.createdAt} >= now() - interval '24 hours')::int`,
      p95DurationMs: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${jobRuns.durationMs}) filter (where ${jobRuns.durationMs} is not null and ${jobRuns.createdAt} >= now() - interval '24 hours'), 0)::int`,
    })
    .from(jobRuns);

  return row;
}

/** Used by the process detail endpoint to expose metrics in the order they were recorded. */
export async function getProcessMetrics(jobRunId: string) {
  return db
    .select({
      metricKey: jobRunEvents.metricKey,
      metricValue: jobRunEvents.metricValue,
      metricUnit: jobRunEvents.metricUnit,
      recordedAt: jobRunEvents.occurredAt,
    })
    .from(jobRunEvents)
    .where(and(eq(jobRunEvents.jobRunId, jobRunId), sql`${jobRunEvents.metricKey} is not null`))
    .orderBy(asc(jobRunEvents.id));
}
