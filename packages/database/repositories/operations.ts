import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import {
  accounts,
  dataQualityIssues,
  instruments,
  jobRuns,
  marketDataCoverage,
  notificationEvents,
  reportRuns,
  systemHealthSnapshots,
} from '../schema/index.js';

export async function listJobRuns(filters: { limit?: number; status?: string; jobType?: string }) {
  const conditions = [];
  if (filters.status) conditions.push(eq(jobRuns.status, filters.status));
  if (filters.jobType) conditions.push(eq(jobRuns.jobType, filters.jobType));

  return db
    .select()
    .from(jobRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobRuns.createdAt))
    .limit(filters.limit ?? 100);
}

export async function createJobRun(values: {
  jobName: string;
  queueName: string;
  jobType: string;
  status?: string;
  scheduledFor?: Date | null;
  payload?: Record<string, unknown>;
  correlationId?: string | null;
}) {
  const [created] = await db
    .insert(jobRuns)
    .values({
      id: uuidv7(),
      jobName: values.jobName,
      queueName: values.queueName,
      jobType: values.jobType,
      status: values.status ?? 'queued',
      scheduledFor: values.scheduledFor ?? null,
      startedAt: null,
      finishedAt: null,
      attempt: 0,
      maxAttempts: 3,
      payload: values.payload ?? {},
      result: null,
      errorMessage: null,
      correlationId: values.correlationId ?? null,
    })
    .returning();
  return created;
}

export async function updateJobRun(
  id: string,
  values: {
    status: string;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    attempt?: number;
    result?: Record<string, unknown> | null;
    errorMessage?: string | null;
  },
) {
  const [updated] = await db.update(jobRuns).set(values).where(eq(jobRuns.id, id)).returning();
  return updated;
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
      openQualityIssues: sql<number>`(select count(*)::int from data_quality_issues where status = 'open')`,
      criticalQualityIssues: sql<number>`(select count(*)::int from data_quality_issues where status = 'open' and severity = 'critical')`,
      queuedJobs: sql<number>`(select count(*)::int from job_runs where status in ('queued','retrying'))`,
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
        where s2.component = ${systemHealthSnapshots.component}
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
      universes: sql<number>`(select count(*)::int from instrument_universes where is_active)`,
      strategies: sql<number>`(select count(*)::int from strategies where status in ('research','active'))`,
      openIssues: sql<number>`(select count(*)::int from data_quality_issues where status = 'open')`,
      criticalIssues: sql<number>`(select count(*)::int from data_quality_issues where status = 'open' and severity = 'critical')`,
      coverageRows: sql<number>`(select count(*)::int from market_data_coverage)`,
      completeCoverage: sql<number>`(select count(*)::int from market_data_coverage where status = 'complete')`,
      partialCoverage: sql<number>`(select count(*)::int from market_data_coverage where status = 'partial')`,
      missingCoverage: sql<number>`(select count(*)::int from market_data_coverage where status = 'missing')`,
      candles: sql<number>`(select count(*)::int from market_candles_1m)`,
      lastIngestionAt: sql<
        string | null
      >`(select max(created_at)::text from market_data_ingestion_runs)`,
    })
    .from(sql`(select 1) as singleton`);

  const recentJobs = await db
    .select({
      id: jobRuns.id,
      jobName: jobRuns.jobName,
      jobType: jobRuns.jobType,
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
      id: dataQualityIssues.id,
      issueType: dataQualityIssues.issueType,
      severity: dataQualityIssues.severity,
      status: dataQualityIssues.status,
      tradingDate: dataQualityIssues.tradingDate,
      detectedAt: dataQualityIssues.detectedAt,
    })
    .from(dataQualityIssues)
    .where(eq(dataQualityIssues.status, 'open'))
    .orderBy(desc(dataQualityIssues.detectedAt))
    .limit(6);

  const latestCoverageDate =
    (
      await db
        .select({ date: sql<string | null>`max(${marketDataCoverage.tradingDate})::text` })
        .from(marketDataCoverage)
    )[0]?.date ?? null;

  const coverageByStatus = await db
    .select({
      status: marketDataCoverage.status,
      count: sql<number>`count(*)::int`,
    })
    .from(marketDataCoverage)
    .where(latestCoverageDate ? eq(marketDataCoverage.tradingDate, latestCoverageDate) : undefined)
    .groupBy(marketDataCoverage.status);

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
      sentAt: null,
      readAt: null,
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
      generatedAt: null,
      fileRef: null,
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
