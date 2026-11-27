import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import { instruments, providers, systemIssues } from '../schema/index.js';

/** Current-state issue ledger: one row per active problem, deleted when it is fixed. */
export interface SystemIssueRow {
  id: string;
  source: string;
  kind: string;
  severity: string;
  providerId: string | null;
  instrumentId: string | null;
  dedupeKey: string;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  payload: Record<string, unknown>;
}

const issueColumns = {
  id: systemIssues.id,
  source: systemIssues.source,
  kind: systemIssues.kind,
  severity: systemIssues.severity,
  providerId: systemIssues.providerId,
  providerCode: providers.code,
  instrumentId: systemIssues.instrumentId,
  symbol: instruments.tradingSymbol,
  dedupeKey: systemIssues.dedupeKey,
  occurrenceCount: systemIssues.occurrenceCount,
  firstSeenAt: systemIssues.firstSeenAt,
  lastSeenAt: systemIssues.lastSeenAt,
  payload: systemIssues.payload,
  scope: sql<'instrument' | 'provider' | 'system'>`
    case
      when ${systemIssues.instrumentId} is not null then 'instrument'
      when ${systemIssues.providerId} is not null then 'provider'
      else 'system'
    end`,
};

export async function upsertSystemIssue(values: {
  source: string;
  kind: string;
  severity: string;
  providerId: string | null;
  instrumentId: string | null;
  dedupeKey: string;
  payload: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(systemIssues)
    .values({
      id: uuidv7(),
      source: values.source,
      kind: values.kind,
      severity: values.severity,
      providerId: values.providerId,
      instrumentId: values.instrumentId,
      dedupeKey: values.dedupeKey,
      occurrenceCount: 1,
      payload: values.payload,
    })
    .onConflictDoUpdate({
      target: systemIssues.dedupeKey,
      set: {
        severity: sql`excluded.severity`,
        occurrenceCount: sql`${systemIssues.occurrenceCount} + 1`,
        lastSeenAt: new Date(),
        payload: sql`excluded.payload`,
      },
    })
    .returning();
  return row;
}

function issueConditions(filters: {
  source?: string;
  kind?: string;
  severity?: string;
  instrumentId?: string;
  providerId?: string;
  scope?: 'instrument' | 'provider' | 'system';
}) {
  const conditions = [];
  if (filters.source) conditions.push(eq(systemIssues.source, filters.source));
  if (filters.kind) conditions.push(eq(systemIssues.kind, filters.kind));
  if (filters.severity) conditions.push(eq(systemIssues.severity, filters.severity));
  if (filters.instrumentId)
    conditions.push(eq(systemIssues.instrumentId, filters.instrumentId));
  if (filters.providerId) conditions.push(eq(systemIssues.providerId, filters.providerId));
  if (filters.scope === 'instrument') conditions.push(isNotNull(systemIssues.instrumentId));
  if (filters.scope === 'provider')
    conditions.push(isNull(systemIssues.instrumentId), isNotNull(systemIssues.providerId));
  if (filters.scope === 'system')
    conditions.push(isNull(systemIssues.instrumentId), isNull(systemIssues.providerId));
  return conditions;
}

/**
 * Newest-seen-first issue page. `last_seen_at` is mutable, so a row bumped during a traversal
 * moves ahead of the cursor and is skipped until the next refresh; it is never duplicated.
 */
export async function listSystemIssues(filters: {
  source?: string;
  kind?: string;
  severity?: string;
  instrumentId?: string;
  providerId?: string;
  scope?: 'instrument' | 'provider' | 'system';
  limit: number;
  after?: { lastSeenAt: Date; id: string };
  before?: { lastSeenAt: Date; id: string };
}) {
  const conditions = issueConditions(filters);
  const backward = Boolean(filters.before);
  const cursor = filters.before ?? filters.after;
  const pageConditions = cursor
    ? [
        ...conditions,
        backward
          ? sql`(${systemIssues.lastSeenAt}, ${systemIssues.id}) > (${cursor.lastSeenAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
          : sql`(${systemIssues.lastSeenAt}, ${systemIssues.id}) < (${cursor.lastSeenAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
      ]
    : conditions;

  const [rows, totalRows] = await Promise.all([
    db
      .select(issueColumns)
      .from(systemIssues)
      .leftJoin(providers, eq(providers.id, systemIssues.providerId))
      .leftJoin(instruments, eq(instruments.id, systemIssues.instrumentId))
      .where(pageConditions.length > 0 ? and(...pageConditions) : undefined)
      .orderBy(
        backward ? asc(systemIssues.lastSeenAt) : desc(systemIssues.lastSeenAt),
        backward ? asc(systemIssues.id) : desc(systemIssues.id),
      )
      .limit(filters.limit + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(systemIssues)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return {
    items: rows.slice(0, filters.limit),
    total: totalRows[0]?.total ?? 0,
    hasExtra: rows.length > filters.limit,
  };
}

export async function getIssueSummary(filters: {
  source?: string;
  kind?: string;
  severity?: string;
  instrumentId?: string;
  providerId?: string;
  scope?: 'instrument' | 'provider' | 'system';
}) {
  const conditions = issueConditions(filters);
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      critical: sql<number>`count(*) filter (where ${systemIssues.severity} = 'critical')::int`,
      instrumentScoped: sql<number>`count(*) filter (where ${systemIssues.instrumentId} is not null)::int`,
      providerScoped: sql<number>`count(*) filter (where ${systemIssues.instrumentId} is null and ${systemIssues.providerId} is not null)::int`,
    })
    .from(systemIssues)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return (
    row ?? { total: 0, critical: 0, instrumentScoped: 0, providerScoped: 0 }
  );
}

export async function getSystemIssue(id: string) {
  const rows = await db
    .select(issueColumns)
    .from(systemIssues)
    .leftJoin(providers, eq(providers.id, systemIssues.providerId))
    .leftJoin(instruments, eq(instruments.id, systemIssues.instrumentId))
    .where(eq(systemIssues.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Newest-seen-first issue page for one instrument. `last_seen_at` is mutable, so the cursor is
 * applied to it and `id` breaks ties; a row bumped mid-traversal moves ahead and is skipped until
 * the next refresh, never duplicated.
 */
export async function listInstrumentIssues(
  instrumentId: string,
  page: {
    limit: number;
    after?: { lastSeenAt: Date; id: string };
    before?: { lastSeenAt: Date; id: string };
  },
) {
  const conditions = [eq(systemIssues.instrumentId, instrumentId)];
  const backward = Boolean(page.before);
  const cursor = page.before ?? page.after;
  const pageConditions = cursor
    ? [
        ...conditions,
        backward
          ? sql`(${systemIssues.lastSeenAt}, ${systemIssues.id}) > (${cursor.lastSeenAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
          : sql`(${systemIssues.lastSeenAt}, ${systemIssues.id}) < (${cursor.lastSeenAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`,
      ]
    : conditions;

  const [rows, totalRows] = await Promise.all([
    db
      .select(issueColumns)
      .from(systemIssues)
      .leftJoin(providers, eq(providers.id, systemIssues.providerId))
      .leftJoin(instruments, eq(instruments.id, systemIssues.instrumentId))
      .where(and(...pageConditions))
      .orderBy(
        backward ? asc(systemIssues.lastSeenAt) : desc(systemIssues.lastSeenAt),
        backward ? asc(systemIssues.id) : desc(systemIssues.id),
      )
      .limit(page.limit + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(systemIssues)
      .where(and(...conditions)),
  ]);

  return {
    items: rows.slice(0, page.limit),
    total: totalRows[0]?.total ?? 0,
    hasExtra: rows.length > page.limit,
  };
}

export async function listInstrumentDayIssues(
  instrumentId: string,
  date: string,
  page: { limit: number; offset: number },
) {
  const conditions = [
    eq(systemIssues.instrumentId, instrumentId),
    sql`${systemIssues.payload}->>'tradingDate' = ${date}`,
  ];

  const [items, totalRows] = await Promise.all([
    db
      .select(issueColumns)
      .from(systemIssues)
      .leftJoin(providers, eq(providers.id, systemIssues.providerId))
      .leftJoin(instruments, eq(instruments.id, systemIssues.instrumentId))
      .where(and(...conditions))
      .orderBy(desc(systemIssues.lastSeenAt), desc(systemIssues.id))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(systemIssues)
      .where(and(...conditions)),
  ]);

  return { items, total: totalRows[0]?.total ?? 0 };
}

export async function listRecentIssues(limit = 6) {
  return db
    .select({
      id: systemIssues.id,
      source: systemIssues.source,
      kind: systemIssues.kind,
      severity: systemIssues.severity,
      instrumentId: systemIssues.instrumentId,
      symbol: instruments.tradingSymbol,
      lastSeenAt: systemIssues.lastSeenAt,
      payload: systemIssues.payload,
    })
    .from(systemIssues)
    .leftJoin(instruments, eq(instruments.id, systemIssues.instrumentId))
    .orderBy(desc(systemIssues.lastSeenAt))
    .limit(limit);
}

export async function getSystemIssueCounts() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      critical: sql<number>`count(*) filter (where ${systemIssues.severity} = 'critical')::int`,
    })
    .from(systemIssues);
  return { total: row?.total ?? 0, critical: row?.critical ?? 0 };
}

export async function countInstrumentCriticalIssues(instrumentId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(systemIssues)
    .where(
      and(
        eq(systemIssues.instrumentId, instrumentId),
        eq(systemIssues.severity, 'critical'),
      ),
    );
  return row?.count ?? 0;
}

/** One ledger row by its writer-owned identity, used to carry repair evidence forward. */
export async function getSystemIssueByDedupeKey(dedupeKey: string) {
  const [row] = await db
    .select()
    .from(systemIssues)
    .where(eq(systemIssues.dedupeKey, dedupeKey))
    .limit(1);
  return row ?? null;
}

/** Removes the exact row a successful operation previously raised. */
export async function clearSystemIssue(dedupeKey: string) {
  await db.delete(systemIssues).where(eq(systemIssues.dedupeKey, dedupeKey));
}

/**
 * Removes the issues owned by one mechanism for a scope. Used when a re-run
 * proves a whole window healthy but per-row keys are no longer known.
 */
export async function clearSystemIssues(filters: {
  sources: string[];
  kinds: string[];
  instrumentId?: string | null;
  providerId?: string | null;
  tradingDate?: string;
}) {
  const conditions = [
    inArray(systemIssues.source, filters.sources),
    inArray(systemIssues.kind, filters.kinds),
  ];
  if (filters.instrumentId)
    conditions.push(eq(systemIssues.instrumentId, filters.instrumentId));
  if (filters.providerId) conditions.push(eq(systemIssues.providerId, filters.providerId));
  if (filters.tradingDate) {
    conditions.push(
      sql`${systemIssues.payload}->>'tradingDate' = ${filters.tradingDate}`,
    );
  }
  await db.delete(systemIssues).where(and(...conditions));
}
