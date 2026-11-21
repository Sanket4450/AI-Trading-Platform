import { and, asc, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { jobRunEvents, jobRuns } from '../schema/index.js';

export interface JobRunEventRecord {
  jobRunId: string;
  stage: string;
  type: 'entered' | 'progress' | 'completed' | 'failed' | 'skipped' | 'warning';
  data?: Record<string, unknown>;
  occurredAt?: Date;
}

/** Appends one batch and advances the job's latest-event pointer in the same transaction. */
export async function appendJobRunEvents(events: JobRunEventRecord[]) {
  if (events.length === 0) return [];

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(jobRunEvents)
      .values(
        events.map((event) => ({
          jobRunId: event.jobRunId,
          stage: event.stage,
          type: event.type,
          data: event.data ?? {},
          occurredAt: event.occurredAt ?? new Date(),
        })),
      )
      .returning({
        id: jobRunEvents.id,
        jobRunId: jobRunEvents.jobRunId,
        stage: jobRunEvents.stage,
        type: jobRunEvents.type,
        occurredAt: jobRunEvents.occurredAt,
        data: jobRunEvents.data,
      });

    const latest = new Map<string, number>();
    for (const row of inserted) {
      latest.set(row.jobRunId, Math.max(latest.get(row.jobRunId) ?? 0, row.id));
    }
    for (const [jobRunId, eventId] of latest) {
      await tx
        .update(jobRuns)
        .set({ latestEventId: eventId })
        .where(eq(jobRuns.id, jobRunId));
    }
    return inserted;
  });
}

/** Moves a queued or retried run to running without touching a terminal status. */
export async function beginJobRunTracking(input: {
  jobRunId: string;
  startedAt: Date;
  attempt: number;
}) {
  const retrying = input.attempt > 0;
  const [updated] = await db
    .update(jobRuns)
    .set({
      startedAt: sql`coalesce(${jobRuns.startedAt}, ${input.startedAt})`,
      status: sql`case when ${jobRuns.status} = 'queued' or (${retrying} and ${jobRuns.status} = 'failed') then 'running' else ${jobRuns.status} end`,
      attempt: input.attempt,
      finishedAt: retrying ? null : sql`${jobRuns.finishedAt}`,
      error: retrying ? null : sql`${jobRuns.error}`,
    })
    .where(eq(jobRuns.id, input.jobRunId))
    .returning();
  return updated ?? null;
}

/** Closes a run only while it is still queued/running, so a cancellation wins the race. */
export async function closeJobRun(input: {
  jobRunId: string;
  status: string;
  result?: unknown;
  error?: unknown;
}) {
  const [row] = await db
    .update(jobRuns)
    .set({
      status: input.status,
      finishedAt: new Date(),
      result: input.result ?? null,
      error: input.error ?? null,
    })
    .where(
      and(
        eq(jobRuns.id, input.jobRunId),
        inArray(jobRuns.status, ['queued', 'running']),
      ),
    )
    .returning();
  return row ?? null;
}

/** Closes the run only when a service has not already reached a terminal status. */
export async function finishJobRunTracking(input: {
  jobRunId: string;
  status: 'succeeded' | 'failed';
  error?: unknown;
}) {
  const [updated] = await db
    .update(jobRuns)
    .set({
      status: sql`case when ${jobRuns.status} in ('queued', 'running') then ${input.status} else ${jobRuns.status} end`,
      finishedAt: sql`coalesce(${jobRuns.finishedAt}, now())`,
      error: sql`coalesce(${input.error ?? null}, ${jobRuns.error})`,
    })
    .where(eq(jobRuns.id, input.jobRunId))
    .returning();
  return updated ?? null;
}

function jobRunConditions(filters: {
  status?: string[];
  instrumentId?: string;
  search?: string;
}) {
  const conditions = [];
  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(jobRuns.status, filters.status));
  }
  if (filters.instrumentId) {
    conditions.push(eq(jobRuns.instrumentId, filters.instrumentId));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    const searchCondition = or(
      ilike(jobRuns.jobName, term),
      ilike(jobRuns.status, term),
      sql`${jobRuns.id}::text ilike ${term}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  return conditions;
}

/**
 * One page of tracked runs. The cursor is a `(created_at, id)` value tuple: `created_at` alone is
 * not unique because a batch enqueue shares one transaction timestamp.
 */
export async function listTrackedJobRuns(filters: {
  limit: number;
  status?: string[];
  instrumentId?: string;
  search?: string;
  after?: { createdAt: Date; id: string };
  before?: { createdAt: Date; id: string };
}) {
  const conditions = jobRunConditions(filters);
  const backward = Boolean(filters.before);
  const cursor = filters.before ?? filters.after;
  const pageConditions = cursor
    ? [
        ...conditions,
        backward
          ? sql`(${jobRuns.createdAt}, ${jobRuns.id}) > (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
          : sql`(${jobRuns.createdAt}, ${jobRuns.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
      ]
    : conditions;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: jobRuns.id,
        jobName: jobRuns.jobName,
        status: jobRuns.status,
        groupId: jobRuns.groupId,
        instrumentId: jobRuns.instrumentId,
        attempt: jobRuns.attempt,
        maxAttempts: jobRuns.maxAttempts,
        createdAt: jobRuns.createdAt,
        startedAt: jobRuns.startedAt,
        finishedAt: jobRuns.finishedAt,
        result: jobRuns.result,
        error: jobRuns.error,
        latestEventId: jobRuns.latestEventId,
        latestStage: jobRunEvents.stage,
        latestType: jobRunEvents.type,
        latestData: jobRunEvents.data,
        latestOccurredAt: jobRunEvents.occurredAt,
      })
      .from(jobRuns)
      .leftJoin(jobRunEvents, eq(jobRunEvents.id, jobRuns.latestEventId))
      .where(pageConditions.length > 0 ? and(...pageConditions) : undefined)
      .orderBy(
        backward ? asc(jobRuns.createdAt) : desc(jobRuns.createdAt),
        backward ? asc(jobRuns.id) : desc(jobRuns.id),
      )
      .limit(filters.limit + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(jobRuns)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return {
    items: rows.slice(0, filters.limit),
    total: totalRows[0]?.total ?? 0,
    hasExtra: rows.length > filters.limit,
  };
}

export async function getJobRun(id: string) {
  const rows = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getLatestJobRunEvent(jobRunId: string) {
  const rows = await db
    .select()
    .from(jobRunEvents)
    .where(eq(jobRunEvents.jobRunId, jobRunId))
    .orderBy(desc(jobRunEvents.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Returns every event for a run in chronological order; used to derive the stage rail. */
export async function getAllJobRunEvents(jobRunId: string) {
  return db
    .select()
    .from(jobRunEvents)
    .where(eq(jobRunEvents.jobRunId, jobRunId))
    .orderBy(asc(jobRunEvents.id));
}

/**
 * One page of a run's events. The response stays chronological: the newest page is fetched
 * descending and reversed, and `beforeId` walks toward older events.
 */
export async function getJobRunEventsPage(
  jobRunId: string,
  filters: { limit: number; beforeId?: number },
) {
  const conditions = [eq(jobRunEvents.jobRunId, jobRunId)];
  if (filters.beforeId !== undefined) {
    conditions.push(lt(jobRunEvents.id, filters.beforeId));
  }

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(jobRunEvents)
      .where(and(...conditions))
      .orderBy(desc(jobRunEvents.id))
      .limit(filters.limit + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(jobRunEvents)
      .where(eq(jobRunEvents.jobRunId, jobRunId)),
  ]);

  return {
    items: rows.slice(0, filters.limit).reverse(),
    total: totalRows[0]?.total ?? 0,
    hasExtra: rows.length > filters.limit,
  };
}

export async function getJobRunSummary() {
  const durationMs = sql`extract(epoch from (${jobRuns.finishedAt} - ${jobRuns.startedAt})) * 1000`;
  const [row] = await db
    .select({
      running: sql<number>`count(*) filter (where ${jobRuns.status} = 'running')::int`,
      failed24h: sql<number>`count(*) filter (where ${jobRuns.status} = 'failed' and ${jobRuns.createdAt} >= now() - interval '24 hours')::int`,
      succeeded24h: sql<number>`count(*) filter (where ${jobRuns.status} = 'succeeded' and ${jobRuns.createdAt} >= now() - interval '24 hours')::int`,
      p95DurationMs: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${durationMs}) filter (where ${jobRuns.startedAt} is not null and ${jobRuns.finishedAt} is not null and ${jobRuns.createdAt} >= now() - interval '24 hours'), 0)::int`,
    })
    .from(jobRuns);

  return row;
}
