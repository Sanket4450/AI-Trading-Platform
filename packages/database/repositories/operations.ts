import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { isJobName, queueNameOf } from '@ai-trading/domain';
import { db } from '../client.js';
import {
  accounts,
  instruments,
  jobRuns,
  instrumentDayCoverage,
  notificationEvents,
  reportRuns,
  systemHealthSnapshots,
  systemIssues,
} from '../schema/index.js';

export async function listJobRuns(filters: { limit?: number; status?: string }) {
  const conditions = [];
  if (filters.status) conditions.push(eq(jobRuns.status, filters.status));

  return db
    .select()
    .from(jobRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobRuns.createdAt))
    .limit(filters.limit ?? 100);
}

/** Creates the row that mirrors a BullMQ job. The caller must enqueue with this id. */
export async function createJobRun(values: {
  jobName: string;
  status?: string;
  groupId?: string | null;
  instrumentId?: string | null;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}) {
  if (!isJobName(values.jobName)) {
    throw new Error(`Unknown job name: ${values.jobName}`);
  }
  if (!queueNameOf(values.jobName)) throw new Error(`Job ${values.jobName} has no queue`);

  const [created] = await db
    .insert(jobRuns)
    .values({
      id: uuidv7(),
      jobName: values.jobName,
      status: values.status ?? 'queued',
      groupId: values.groupId ?? null,
      instrumentId: values.instrumentId ?? null,
      attempt: 0,
      maxAttempts: values.maxAttempts ?? 1,
      payload: values.payload ?? {},
      result: null,
      error: null,
    })
    .returning();
  return created;
}

export async function updateJobRun(
  id: string,
  values: {
    status?: string;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    attempt?: number;
    maxAttempts?: number;
    result?: unknown;
    error?: unknown;
  },
) {
  const [updated] = await db.update(jobRuns).set(values).where(eq(jobRuns.id, id)).returning();
  return updated;
}

/** Removes a row when the matching BullMQ job could not be created. */
export async function deleteJobRun(id: string) {
  await db.delete(jobRuns).where(eq(jobRuns.id, id));
}

export async function listHealthSnapshots(filters: { limit?: number; component?: string }) {
  return db
    .select()
    .from(systemHealthSnapshots)
    .where(filters.component ? eq(systemHealthSnapshots.component, filters.component) : undefined)
    .orderBy(desc(systemHealthSnapshots.capturedAt))
    .limit(filters.limit ?? 100);
}

export async function recordHealthSnapshot(values: {
  component: string;
  status: string;
  latencyMs: number | null;
  details: Record<string, unknown>;
}) {
  const [created] = await db
    .insert(systemHealthSnapshots)
    .values({
      id: uuidv7(),
      component: values.component,
      status: values.status,
      latencyMs: values.latencyMs,
      details: values.details,
    })
    .returning();
  return created;
}

export async function getSystemStatus() {
  const [counts] = await db
    .select({
      accounts: sql<number>`(select count(*)::int from accounts)`,
      activeAccounts: sql<number>`(select count(*)::int from accounts where is_active)`,
      instruments: sql<number>`(select count(*)::int from instruments where is_active)`,
      strategies: sql<number>`(select count(*)::int from strategies)`,
      openIssues: sql<number>`(select count(*)::int from system_issues)`,
      criticalIssues: sql<number>`(select count(*)::int from system_issues where severity = 'critical')`,
      queuedJobs: sql<number>`(select count(*)::int from job_runs where status = 'queued')`,
      runningJobs: sql<number>`(select count(*)::int from job_runs where status = 'running')`,
      failedJobs24h: sql<number>`(select count(*)::int from job_runs where status = 'failed' and created_at >= now() - interval '24 hours')`,
      latestJobAt: sql<string | null>`(select max(created_at)::text from job_runs)`,
    })
    .from(sql`(select 1) as singleton`);

  const latestHealth = await db
    .select({
      component: systemHealthSnapshots.component,
      status: systemHealthSnapshots.status,
      latencyMs: systemHealthSnapshots.latencyMs,
      capturedAt: systemHealthSnapshots.capturedAt,
    })
    .from(systemHealthSnapshots)
    .where(
      sql`${systemHealthSnapshots.capturedAt} = (
        select max(s2.captured_at) from system_health_snapshots s2
        where s2.component = "system_health_snapshots"."component"
      )`,
    )
    .orderBy(asc(systemHealthSnapshots.component));

  const mode =
    (
      await db
        .select({ mode: accounts.mode })
        .from(accounts)
        .where(eq(accounts.isActive, true))
        .limit(1)
    )[0]?.mode ?? 'offline';

  return {
    mode,
    counts,
    latestHealth,
  };
}

export async function getDashboardOverview() {
  const [counts] = await db
    .select({
      accounts: sql<number>`(select count(*)::int from accounts where is_active)`,
      instruments: sql<number>`(select count(*)::int from instruments where is_active)`,
      syncTargets: sql<number>`(select count(*)::int from instruments where is_sync_target)`,
      strategies: sql<number>`(select count(*)::int from strategies where status in ('research','active'))`,
      openIssues: sql<number>`(select count(*)::int from system_issues)`,
      criticalIssues: sql<number>`(select count(*)::int from system_issues where severity = 'critical')`,
      coverageRows: sql<number>`(select count(*)::int from instrument_day_coverage)`,
      completeCoverage: sql<number>`(select count(*)::int from instrument_day_coverage where stored_bars = expected_bars)`,
      partialCoverage: sql<number>`(select count(*)::int from instrument_day_coverage where stored_bars > 0 and stored_bars < expected_bars)`,
      missingCoverage: sql<number>`(select count(*)::int from instrument_day_coverage where stored_bars = 0)`,
      candles: sql<number>`(select count(*)::int from market_candles_1m)`,
      lastIngestionAt: sql<
        string | null
      >`(select max(finished_at)::text from job_runs where status in ('succeeded', 'partially_failed'))`,
    })
    .from(sql`(select 1) as singleton`);

  const recentJobs = await db
    .select({
      id: jobRuns.id,
      jobName: jobRuns.jobName,
      status: jobRuns.status,
      startedAt: jobRuns.startedAt,
      finishedAt: jobRuns.finishedAt,
      createdAt: jobRuns.createdAt,
    })
    .from(jobRuns)
    .orderBy(desc(jobRuns.createdAt))
    .limit(6);

  const openIssues = await db
    .select({
      id: systemIssues.id,
      instrumentId: systemIssues.instrumentId,
      kind: systemIssues.kind,
      source: systemIssues.source,
      severity: systemIssues.severity,
      lastSeenAt: systemIssues.lastSeenAt,
      payload: systemIssues.payload,
    })
    .from(systemIssues)
    .orderBy(desc(systemIssues.lastSeenAt))
    .limit(6);

  const latestCoverageDate =
    (
      await db
        .select({ date: sql<string | null>`max(${instrumentDayCoverage.tradingDate})::text` })
        .from(instrumentDayCoverage)
    )[0]?.date ?? null;

  const coverageByStatus = await db
    .select({
      status: sql<string>`
        case
          when ${instrumentDayCoverage.storedBars} = 0 then 'missing'
          when ${instrumentDayCoverage.storedBars} = ${instrumentDayCoverage.expectedBars} then 'complete'
          else 'partial'
        end`,
      count: sql<number>`count(*)::int`,
    })
    .from(instrumentDayCoverage)
    .where(
      latestCoverageDate
        ? eq(instrumentDayCoverage.tradingDate, latestCoverageDate)
        : undefined,
    )
    .groupBy(sql`1`);

  return {
    counts,
    recentJobs,
    openIssues,
    latestCoverageDate,
    coverageByStatus,
  };
}

export async function listNotificationEvents(limit = 100) {
  return db
    .select()
    .from(notificationEvents)
    .orderBy(desc(notificationEvents.createdAt))
    .limit(limit);
}

export async function createNotificationEvent(values: {
  channel: string;
  severity: string;
  eventType: string;
  subject: string;
  body: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}) {
  const [created] = await db
    .insert(notificationEvents)
    .values({
      id: uuidv7(),
      channel: values.channel,
      severity: values.severity,
      eventType: values.eventType,
      subject: values.subject,
      body: values.body,
      relatedEntityType: values.relatedEntityType ?? null,
      relatedEntityId: values.relatedEntityId ?? null,
      status: 'pending',
    })
    .returning();
  return created;
}

export async function listReportRuns(limit = 100) {
  return db.select().from(reportRuns).orderBy(desc(reportRuns.createdAt)).limit(limit);
}

export async function createReportRun(values: {
  reportType: string;
  periodStart: string;
  periodEnd: string;
  parameters: Record<string, unknown>;
}) {
  const [created] = await db
    .insert(reportRuns)
    .values({
      id: uuidv7(),
      reportType: values.reportType,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
      status: 'queued',
      parameters: values.parameters,
    })
    .returning();
  return created;
}

export async function getInstrumentCounts() {
  return db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${instruments.isActive})::int`,
      equities: sql<number>`count(*) filter (where ${instruments.instrumentType} = 'EQ')::int`,
      indices: sql<number>`count(*) filter (where ${instruments.instrumentType} = 'INDEX')::int`,
    })
    .from(instruments);
}
