import { and, asc, desc, eq, gt, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { ExternalApiOutcome, ExternalApiScope } from '@ai-trading/domain';
import { db } from '../client.js';
import { externalApiCalls, instruments, jobRuns } from '../schema/index.js';

export interface ExternalApiCallRecord {
  jobRunId?: string | null;
  instrumentId?: string | null;
  startedAt: Date;
  latencyMs: number;
  service: string;
  operation: string;
  requestScope: ExternalApiScope;
  statusCode?: number | null;
  outcome: ExternalApiOutcome;
  errorBody?: string | null;
}

/** One buffered batch from the runtime recorder. Failures are logged by the caller, not here. */
export async function insertExternalApiCalls(rows: ExternalApiCallRecord[]) {
  if (rows.length === 0) return [];

  return db
    .insert(externalApiCalls)
    .values(
      rows.map((row) => ({
        jobRunId: row.jobRunId ?? null,
        instrumentId: row.instrumentId ?? null,
        startedAt: row.startedAt,
        latencyMs: row.latencyMs,
        service: row.service,
        operation: row.operation,
        requestScope: row.requestScope,
        statusCode: row.statusCode ?? null,
        outcome: row.outcome,
        errorBody: row.errorBody ?? null,
      })),
    )
    .returning({
      id: externalApiCalls.id,
      jobRunId: externalApiCalls.jobRunId,
      instrumentId: externalApiCalls.instrumentId,
      startedAt: externalApiCalls.startedAt,
      latencyMs: externalApiCalls.latencyMs,
      service: externalApiCalls.service,
      operation: externalApiCalls.operation,
      requestScope: externalApiCalls.requestScope,
      statusCode: externalApiCalls.statusCode,
      outcome: externalApiCalls.outcome,
      errorBody: externalApiCalls.errorBody,
    });
}

const callColumns = {
  id: externalApiCalls.id,
  jobRunId: externalApiCalls.jobRunId,
  jobName: jobRuns.jobName,
  instrumentId: externalApiCalls.instrumentId,
  instrumentSymbol: instruments.tradingSymbol,
  startedAt: externalApiCalls.startedAt,
  latencyMs: externalApiCalls.latencyMs,
  service: externalApiCalls.service,
  operation: externalApiCalls.operation,
  requestScope: externalApiCalls.requestScope,
  statusCode: externalApiCalls.statusCode,
  outcome: externalApiCalls.outcome,
  errorBody: externalApiCalls.errorBody,
};

export interface ExternalApiCallFilters {
  jobRunId?: string;
  services?: string[];
  outcomes?: string[];
  search?: string;
}

function callConditions(filters: ExternalApiCallFilters) {
  const conditions: SQL[] = [];
  if (filters.jobRunId) conditions.push(eq(externalApiCalls.jobRunId, filters.jobRunId));
  if (filters.services && filters.services.length > 0) {
    conditions.push(inArray(externalApiCalls.service, filters.services));
  }
  if (filters.outcomes && filters.outcomes.length > 0) {
    conditions.push(inArray(externalApiCalls.outcome, filters.outcomes));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    const match = or(
      ilike(externalApiCalls.operation, term),
      ilike(externalApiCalls.service, term),
      ilike(instruments.tradingSymbol, term),
      ilike(jobRuns.jobName, term),
    );
    if (match) conditions.push(match);
  }
  return conditions;
}

function baseQuery() {
  return db
    .select(callColumns)
    .from(externalApiCalls)
    .leftJoin(instruments, eq(instruments.id, externalApiCalls.instrumentId))
    .leftJoin(jobRuns, eq(jobRuns.id, externalApiCalls.jobRunId));
}

/**
 * Newest-first page of one run's calls. `afterId` walks toward older rows; `beforeId` walks back
 * toward newer ones, so the page can be reversed for the previous-page control.
 */
export async function listJobApiCalls(filters: {
  jobRunId: string;
  limit: number;
  afterId?: number;
  beforeId?: number;
  outcomes?: string[];
  services?: string[];
}) {
  const conditions: SQL[] = [eq(externalApiCalls.jobRunId, filters.jobRunId)];
  if (filters.services && filters.services.length > 0) {
    conditions.push(inArray(externalApiCalls.service, filters.services));
  }
  if (filters.outcomes && filters.outcomes.length > 0) {
    conditions.push(inArray(externalApiCalls.outcome, filters.outcomes));
  }

  const pageConditions = [...conditions];
  const backward = filters.beforeId !== undefined;
  if (filters.afterId !== undefined) {
    pageConditions.push(lt(externalApiCalls.id, filters.afterId));
  }
  if (filters.beforeId !== undefined) {
    pageConditions.push(gt(externalApiCalls.id, filters.beforeId));
  }

  const [rows, totalRows] = await Promise.all([
    baseQuery()
      .where(and(...pageConditions))
      .orderBy(backward ? asc(externalApiCalls.id) : desc(externalApiCalls.id))
      .limit(filters.limit + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(externalApiCalls)
      .where(and(...conditions)),
  ]);

  const pageRows = rows.slice(0, filters.limit);
  return {
    items: backward ? pageRows.reverse() : pageRows,
    total: totalRows[0]?.total ?? 0,
    hasExtra: rows.length > filters.limit,
  };
}

/**
 * Global call list. Keyset pagination on `(started_at, id)` matches every other list page, so a
 * burst of calls inside one millisecond cannot repeat or skip a row.
 */
export async function listExternalApiCalls(filters: {
  limit: number;
  services?: string[];
  outcomes?: string[];
  search?: string;
  after?: { startedAt: Date; id: string };
  before?: { startedAt: Date; id: string };
}) {
  const conditions = callConditions(filters);
  const backward = Boolean(filters.before);
  const cursor = filters.before ?? filters.after;
  const pageConditions = [...conditions];

  if (cursor) {
    const comparison = backward
      ? sql`(${externalApiCalls.startedAt}, ${externalApiCalls.id}) > (${cursor.startedAt.toISOString()}::timestamptz, ${cursor.id}::bigint)`
      : sql`(${externalApiCalls.startedAt}, ${externalApiCalls.id}) < (${cursor.startedAt.toISOString()}::timestamptz, ${cursor.id}::bigint)`;
    pageConditions.push(comparison);
  }

  const [rows, totalRows] = await Promise.all([
    baseQuery()
      .where(and(...pageConditions))
      .orderBy(
        backward ? asc(externalApiCalls.startedAt) : desc(externalApiCalls.startedAt),
        backward ? asc(externalApiCalls.id) : desc(externalApiCalls.id),
      )
      .limit(filters.limit + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(externalApiCalls)
      .leftJoin(instruments, eq(instruments.id, externalApiCalls.instrumentId))
      .leftJoin(jobRuns, eq(jobRuns.id, externalApiCalls.jobRunId))
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return {
    items: rows.slice(0, filters.limit),
    total: totalRows[0]?.total ?? 0,
    hasExtra: rows.length > filters.limit,
  };
}

/** Counts per outcome plus latency for the summary strip above a call table. */
export async function summarizeExternalApiCalls(filters: ExternalApiCallFilters = {}) {
  const conditions = callConditions(filters);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, latencyRows] = await Promise.all([
    db
      .select({
        outcome: externalApiCalls.outcome,
        count: sql<number>`count(*)::int`,
      })
      .from(externalApiCalls)
      .leftJoin(instruments, eq(instruments.id, externalApiCalls.instrumentId))
      .leftJoin(jobRuns, eq(jobRuns.id, externalApiCalls.jobRunId))
      .where(where)
      .groupBy(externalApiCalls.outcome),
    db
      .select({
        p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${externalApiCalls.latencyMs}), 0)::int`,
        maxLatencyMs: sql<number>`coalesce(max(${externalApiCalls.latencyMs}), 0)::int`,
      })
      .from(externalApiCalls)
      .leftJoin(instruments, eq(instruments.id, externalApiCalls.instrumentId))
      .leftJoin(jobRuns, eq(jobRuns.id, externalApiCalls.jobRunId))
      .where(where),
  ]);

  return {
    outcomes: rows,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    p95LatencyMs: latencyRows[0]?.p95LatencyMs ?? 0,
    maxLatencyMs: latencyRows[0]?.maxLatencyMs ?? 0,
  };
}

/** Retention sweep; returns how many rows the delete removed. */
export async function deleteExternalApiCallsBefore(cutoff: Date): Promise<number> {
  const rows = await db
    .delete(externalApiCalls)
    .where(lt(externalApiCalls.startedAt, cutoff))
    .returning({ id: externalApiCalls.id });
  return rows.length;
}
