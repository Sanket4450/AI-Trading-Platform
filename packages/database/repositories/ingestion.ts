import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';
import { db } from '../client.js';
import {
  exchanges,
  instrumentDataStatus,
  instrumentDayCoverage,
  instrumentProviderMappings,
  instruments,
  jobRuns,
  marketCandles1m,
  rawProviderPayloads,
} from '../schema/index.js';
import { listInstrumentDayIssues } from './issues.js';

type CandleInsert = InferInsertModel<typeof marketCandles1m>;

const activeBackfillStatuses = ['queued', 'running'];

const ingestionJobNames = [
  'instrument-sync',
  'calendar-sync',
  'historical-backfill',
  'historical-finalize',
  'intraday-sync',
  'coverage-recompute',
  'quality-scan',
  'ingestion-reconcile',
];

export async function findActiveBackfillJob(instrumentId: string) {
  const rows = await db
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobName, 'historical-backfill'),
        inArray(jobRuns.status, activeBackfillStatuses),
        eq(jobRuns.instrumentId, instrumentId),
      ),
    )
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRunningJobsOlderThan(minutes: number) {
  return db
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.status, 'running'),
        isNotNull(jobRuns.startedAt),
        sql`${jobRuns.startedAt} < now() - (${minutes} || ' minutes')::interval`,
      ),
    );
}

export async function markStaleJobsFailed(minutes: number) {
  const stale = await listRunningJobsOlderThan(minutes);
  if (stale.length === 0) return [];
  await db
    .update(jobRuns)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      error: {
        code: 'stale_job',
        message: `Stale job recovered after ${minutes} minutes without a heartbeat`,
        retryable: true,
      },
    })
    .where(
      and(
        eq(jobRuns.status, 'running'),
        inArray(
          jobRuns.id,
          stale.map((row) => row.id),
        ),
      ),
    );
  return stale;
}

export async function getLatestJobForInstrument(instrumentId: string) {
  const rows = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.instrumentId, instrumentId))
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLastSuccessfulJobForInstrument(instrumentId: string) {
  const rows = await db
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobName, 'historical-backfill'),
        eq(jobRuns.status, 'succeeded'),
        eq(jobRuns.instrumentId, instrumentId),
      ),
    )
    .orderBy(desc(jobRuns.finishedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getExistingCandles(instrumentId: string, from: Date, to: Date) {
  return db
    .select({
      candleStart: marketCandles1m.candleStart,
      open: marketCandles1m.open,
      high: marketCandles1m.high,
      low: marketCandles1m.low,
      close: marketCandles1m.close,
      volume: marketCandles1m.volume,
      isFinal: marketCandles1m.isFinal,
      rawPayloadId: marketCandles1m.rawPayloadId,
    })
    .from(marketCandles1m)
    .where(
      and(
        eq(marketCandles1m.instrumentId, instrumentId),
        gte(marketCandles1m.candleStart, from),
        lte(marketCandles1m.candleStart, to),
      ),
    )
    .orderBy(asc(marketCandles1m.candleStart));
}

export interface CandleRevision {
  candleStart: Date;
  old: Record<string, unknown>;
  incoming: CandleInsert;
}

export interface CandleWriteResult {
  inserted: number;
  updated: number;
  skipped: number;
  revisions: CandleRevision[];
}

/**
 * Idempotent batch writer. Identical rows are skipped; a final value that
 * differs from a stored final value is surfaced as a revision before it is
 * written. The natural key is (instrument_id, candle_start).
 */
export async function writeCandles(
  rows: CandleInsert[],
  options: { batchSize?: number } = {},
): Promise<CandleWriteResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0, skipped: 0, revisions: [] };
  const byInstrument = new Map<string, CandleInsert[]>();
  for (const row of rows) {
    const list = byInstrument.get(row.instrumentId) ?? [];
    list.push(row);
    byInstrument.set(row.instrumentId, list);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const revisions: CandleRevision[] = [];
  const batchSize = options.batchSize ?? 1000;

  for (const [instrumentId, instrumentRows] of byInstrument) {
    const starts = instrumentRows.map((row) => row.candleStart as Date);
    const from = new Date(Math.min(...starts.map((value) => value.getTime())));
    const to = new Date(Math.max(...starts.map((value) => value.getTime())));
    const existing = await getExistingCandles(instrumentId, from, to);
    const existingByKey = new Map(existing.map((row) => [row.candleStart.toISOString(), row]));

    const toInsert: CandleInsert[] = [];
    const toUpdate: CandleInsert[] = [];
    for (const row of instrumentRows) {
      const current = existingByKey.get((row.candleStart as Date).toISOString());
      if (!current) {
        toInsert.push(row);
        continue;
      }
      const identical =
        current.open === row.open &&
        current.high === row.high &&
        current.low === row.low &&
        current.close === row.close &&
        current.volume === row.volume &&
        current.isFinal === row.isFinal;
      if (identical) {
        skipped += 1;
        continue;
      }
      if (current.isFinal && !row.isFinal) {
        skipped += 1;
        continue;
      }
      if (current.isFinal && row.isFinal) {
        revisions.push({
          candleStart: row.candleStart as Date,
          old: {
            ...current,
            instrumentId,
            candleStart: current.candleStart,
          } as CandleInsert,
          incoming: row,
        });
      }
      toUpdate.push(row);
    }

    for (let index = 0; index < toInsert.length; index += batchSize) {
      const batch = toInsert.slice(index, index + batchSize);
      await db.insert(marketCandles1m).values(batch).onConflictDoNothing();
      inserted += batch.length;
    }

    for (let index = 0; index < toUpdate.length; index += batchSize) {
      const batch = toUpdate.slice(index, index + batchSize);
      await db
        .insert(marketCandles1m)
        .values(batch)
        .onConflictDoUpdate({
          target: [marketCandles1m.instrumentId, marketCandles1m.candleStart],
          set: {
            tradingDate: sql`excluded.trading_date`,
            open: sql`excluded.open`,
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            close: sql`excluded.close`,
            volume: sql`excluded.volume`,
            sourceProviderId: sql`excluded.source_provider_id`,
            rawPayloadId: sql`excluded.raw_payload_id`,
            isFinal: sql`excluded.is_final`,
            updatedAt: new Date(),
          },
        });
      updated += batch.length;
    }
  }

  return { inserted, updated, skipped, revisions };
}

export async function getCoverageDayDetail(instrumentId: string, date: string) {
  const coverage = await db
    .select({
      instrumentId: instrumentDayCoverage.instrumentId,
      tradingDate: instrumentDayCoverage.tradingDate,
      expectedBars: instrumentDayCoverage.expectedBars,
      storedBars: instrumentDayCoverage.storedBars,
      checkedAt: instrumentDayCoverage.checkedAt,
      status: sql<string>`
        case
          when ${instrumentDayCoverage.storedBars} = 0 then 'missing'
          when ${instrumentDayCoverage.storedBars} = ${instrumentDayCoverage.expectedBars} then 'complete'
          else 'partial'
        end`,
    })
    .from(instrumentDayCoverage)
    .where(
      and(
        eq(instrumentDayCoverage.instrumentId, instrumentId),
        eq(instrumentDayCoverage.tradingDate, date),
      ),
    )
    .limit(1);
  const instrument = await db
    .select({
      id: instruments.id,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      tickSize: instruments.tickSize,
    })
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);
  const issues = await listInstrumentDayIssues(instrumentId, date, { limit: 50, offset: 0 });
  return {
    instrument: instrument[0] ?? null,
    coverage: coverage[0] ?? null,
    issues: issues.items,
  };
}

export async function getProviderStatus() {
  const [runs] = await db
    .select({
      lastSuccessfulSyncAt: sql<
        string | null
      >`max(${jobRuns.finishedAt}) filter (where ${jobRuns.jobName} = 'instrument-sync' and ${jobRuns.status} = 'succeeded')::text`,
      lastSuccessfulBackfillAt: sql<
        string | null
      >`max(${jobRuns.finishedAt}) filter (where ${jobRuns.jobName} = 'historical-backfill' and ${jobRuns.status} = 'succeeded')::text`,
      lastSuccessfulIntradayAt: sql<
        string | null
      >`max(${jobRuns.finishedAt}) filter (where ${jobRuns.jobName} = 'intraday-sync' and ${jobRuns.status} = 'succeeded')::text`,
      failedRuns24h: sql<number>`count(*) filter (where ${jobRuns.status} = 'failed' and ${jobRuns.createdAt} >= now() - interval '24 hours')::int`,
      runningChunks: sql<number>`count(*) filter (where ${jobRuns.status} = 'running')::int`,
      queuedChunks: sql<number>`count(*) filter (where ${jobRuns.status} = 'queued')::int`,
    })
    .from(jobRuns)
    .where(inArray(jobRuns.jobName, ingestionJobNames));
  const [payloads] = await db
    .select({
      payloadCount: sql<number>`count(*)::int`,
      payloadBytes: sql<number>`coalesce(sum(${rawProviderPayloads.payloadBytes}), 0)::bigint`,
      oldestPayloadAt: sql<string | null>`min(${rawProviderPayloads.fetchedAt})::text`,
    })
    .from(rawProviderPayloads);
  return { ...runs, ...payloads };
}

export async function getCatalogSummary(filters: {
  fetchStatus?: string;
  dataStatus?: string;
  search?: string;
} = {}) {
  const conditions = [eq(instruments.isSyncTarget, true)];
  if (filters.fetchStatus) {
    conditions.push(eq(instrumentDataStatus.fetchStatus, filters.fetchStatus));
  }
  if (filters.dataStatus) {
    conditions.push(eq(instrumentDataStatus.dataStatus, filters.dataStatus));
  }
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(instruments.tradingSymbol, term),
      ilike(instruments.name, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      notRequested: sql<number>`count(*) filter (where ${instrumentDataStatus.fetchStatus} = 'not_requested' or ${instrumentDataStatus.instrumentId} is null)::int`,
      queued: sql<number>`count(*) filter (where ${instrumentDataStatus.fetchStatus} = 'queued')::int`,
      fetching: sql<number>`count(*) filter (where ${instrumentDataStatus.fetchStatus} = 'fetching')::int`,
      fetched: sql<number>`count(*) filter (where ${instrumentDataStatus.fetchStatus} = 'fetched')::int`,
      partialFetch: sql<number>`count(*) filter (where ${instrumentDataStatus.fetchStatus} = 'partial')::int`,
      failed: sql<number>`count(*) filter (where ${instrumentDataStatus.fetchStatus} = 'failed')::int`,
      complete: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'complete')::int`,
      partialMismatch: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'partial_mismatch')::int`,
      missing: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'missing')::int`,
      needsReview: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'needs_review')::int`,
    })
    .from(instruments)
    .leftJoin(
      instrumentDataStatus,
      eq(instrumentDataStatus.instrumentId, instruments.id),
    )
    .where(and(...conditions));
  return row ?? null;
}

export async function getSyncTargetInstruments() {
  return db
    .select({
      instrumentId: instruments.id,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      tickSize: instruments.tickSize,
      listedOn: instruments.listedOn,
      delistedOn: instruments.delistedOn,
      isActive: instruments.isActive,
      externalKey: sql<string | null>`(
        select m.external_key from instrument_provider_mappings m
        where m.instrument_id = "instruments"."id" and m.is_primary
        order by m.valid_from desc limit 1
      )`,
    })
    .from(instruments)
    .where(eq(instruments.isSyncTarget, true))
    .orderBy(asc(instruments.tradingSymbol));
}

export async function getSyncTargetInstrumentIds() {
  const rows = await getSyncTargetInstruments();
  return rows.map((row) => row.instrumentId);
}

export async function getInstrumentTickSize(instrumentId: string) {
  const rows = await db
    .select({ tickSize: instruments.tickSize })
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);
  return rows[0]?.tickSize ?? '0.05';
}

export async function getInstrumentSymbol(instrumentId: string) {
  const rows = await db
    .select({ symbol: instruments.tradingSymbol, exchangeId: instruments.exchangeId })
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestCoverageDate() {
  const [row] = await db
    .select({ date: sql<string | null>`max(${instrumentDayCoverage.tradingDate})::text` })
    .from(instrumentDayCoverage);
  return row?.date ?? null;
}

export async function countCandlesForInstrument(instrumentId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(marketCandles1m)
    .where(eq(marketCandles1m.instrumentId, instrumentId));
  return row?.count ?? 0;
}

export async function getTradingSessionsForRange(from: string, to: string) {
  return db.execute<{
    trading_date: string;
    is_trading_day: boolean;
    session_open: string | null;
    session_close: string | null;
    description: string | null;
  }>(sql`
    select tc.trading_date::text, tc.is_trading_day,
           tc.session_open::text, tc.session_close::text, tc.description
    from trading_calendar tc
    join exchanges e on e.id = tc.exchange_id
    where e.code = 'NSE' and tc.trading_date between ${from} and ${to}
    order by tc.trading_date
  `);
}

export async function getNseExchange() {
  const rows = await db.select().from(exchanges).where(eq(exchanges.code, 'NSE')).limit(1);
  return rows[0] ?? null;
}

export async function getTradingCalendarRow(date: string) {
  const rows = await db.execute<{
    exchange_id: string;
    exchange_code: string;
    trading_date: string;
    is_trading_day: boolean;
    session_open: string | null;
    session_close: string | null;
    description: string | null;
  }>(sql`
    select tc.exchange_id, e.code as exchange_code, tc.trading_date::text,
           tc.is_trading_day, tc.session_open::text, tc.session_close::text, tc.description
    from trading_calendar tc
    join exchanges e on e.id = tc.exchange_id
    where e.code = 'NSE' and tc.trading_date = ${date}
    limit 1
  `);
  return rows[0] ?? null;
}

export async function getLatestCompletedSession(now: Date = new Date()) {
  const rows = await db.execute<{ trading_date: string }>(sql`
    select tc.trading_date::text
    from trading_calendar tc
    join exchanges e on e.id = tc.exchange_id
    where e.code = 'NSE'
      and tc.is_trading_day
      and tc.session_close <= ${now.toISOString()}
    order by tc.trading_date desc
    limit 1
  `);
  return rows[0]?.trading_date ?? null;
}

export async function getRawPayloadByFingerprint(values: {
  providerId: string;
  requestFingerprint: string;
  payloadSha256: string;
}) {
  const rows = await db
    .select()
    .from(rawProviderPayloads)
    .where(
      and(
        eq(rawProviderPayloads.providerId, values.providerId),
        eq(rawProviderPayloads.requestFingerprint, values.requestFingerprint),
        eq(rawProviderPayloads.payloadSha256, values.payloadSha256),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getCandleUpdatedAt(instrumentId: string, tradingDate: string) {
  const rows = await db.execute<{ updated_at: string | null }>(sql`
    select max(${marketCandles1m.updatedAt})::text as updated_at
    from ${marketCandles1m}
    where ${marketCandles1m.instrumentId} = ${instrumentId}
      and ${marketCandles1m.tradingDate} = ${tradingDate}
  `);
  return rows[0]?.updated_at ? new Date(rows[0].updated_at) : null;
}

export async function getPrimaryMappingCount(instrumentId: string, providerId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(instrumentProviderMappings)
    .where(
      and(
        eq(instrumentProviderMappings.instrumentId, instrumentId),
        eq(instrumentProviderMappings.providerId, providerId),
        eq(instrumentProviderMappings.isPrimary, true),
        sql`${instrumentProviderMappings.validTo} is null`,
      ),
    );
  return row?.count ?? 0;
}

export async function getDailyAggregatesFromMinutes(
  instrumentId: string,
  from: string,
  to: string,
) {
  return db.execute<{
    trading_date: string;
    open: string;
    close: string;
    volume: string;
    bars: number;
  }>(sql`
    select
      ${marketCandles1m.tradingDate}::text as trading_date,
      (array_agg(${marketCandles1m.open} order by ${marketCandles1m.candleStart}))[1]::text as open,
      (array_agg(${marketCandles1m.close} order by ${marketCandles1m.candleStart} desc))[1]::text as close,
      coalesce(sum(${marketCandles1m.volume}), 0)::text as volume,
      count(*)::int as bars
    from ${marketCandles1m}
    where ${marketCandles1m.instrumentId} = ${instrumentId}
      and ${marketCandles1m.tradingDate} between ${from} and ${to}
    group by ${marketCandles1m.tradingDate}
    order by ${marketCandles1m.tradingDate}
  `);
}

export async function getInstrumentStatusRow(instrumentId: string) {
  const rows = await db
    .select()
    .from(instrumentDataStatus)
    .where(eq(instrumentDataStatus.instrumentId, instrumentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCoverageMonths(instrumentIds: string[], from: string, to: string) {
  if (instrumentIds.length === 0) return [];
  return db
    .select({
      instrumentId: instrumentDayCoverage.instrumentId,
      month: sql<string>`to_char(date_trunc('month', ${instrumentDayCoverage.tradingDate}), 'YYYY-MM')`,
      complete: sql<number>`count(*) filter (where ${instrumentDayCoverage.storedBars} = ${instrumentDayCoverage.expectedBars})::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(instrumentDayCoverage)
    .where(
      and(
        inArray(instrumentDayCoverage.instrumentId, instrumentIds),
        gte(instrumentDayCoverage.tradingDate, from),
        lte(instrumentDayCoverage.tradingDate, to),
      ),
    )
    .groupBy(
      instrumentDayCoverage.instrumentId,
      sql`date_trunc('month', ${instrumentDayCoverage.tradingDate})`,
    );
}

export async function isMonthComplete(instrumentId: string, from: string, to: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      complete: sql<number>`count(*) filter (where ${instrumentDayCoverage.storedBars} = ${instrumentDayCoverage.expectedBars})::int`,
    })
    .from(instrumentDayCoverage)
    .where(
      and(
        eq(instrumentDayCoverage.instrumentId, instrumentId),
        gte(instrumentDayCoverage.tradingDate, from),
        lte(instrumentDayCoverage.tradingDate, to),
      ),
    );
  return Boolean(row && row.total > 0 && row.complete === row.total);
}

export async function getInstrumentListing(instrumentId: string) {
  const rows = await db
    .select({
      listedOn: instruments.listedOn,
      delistedOn: instruments.delistedOn,
      isActive: instruments.isActive,
    })
    .from(instruments)
    .where(eq(instruments.id, instrumentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCoverageInputs(instrumentId: string, from: string, to: string) {
  return db.execute<{
    trading_date: string;
    has_partial: boolean;
    starts: (string | Date)[];
  }>(sql`
    select
      ${marketCandles1m.tradingDate}::text as trading_date,
      bool_or(not ${marketCandles1m.isFinal}) as has_partial,
      json_agg(${marketCandles1m.candleStart} order by ${marketCandles1m.candleStart}) as starts
    from ${marketCandles1m}
    where ${marketCandles1m.instrumentId} = ${instrumentId}
      and ${marketCandles1m.tradingDate} between ${from} and ${to}
    group by ${marketCandles1m.tradingDate}
    order by ${marketCandles1m.tradingDate}
  `);
}

export async function upsertCoverageBatch(rows: (typeof instrumentDayCoverage.$inferInsert)[]) {
  if (rows.length === 0) return 0;
  const batchSize = 500;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    await db
      .insert(instrumentDayCoverage)
      .values(batch)
      .onConflictDoUpdate({
        target: [instrumentDayCoverage.instrumentId, instrumentDayCoverage.tradingDate],
        set: {
          expectedBars: sql`excluded.expected_bars`,
          storedBars: sql`excluded.stored_bars`,
          checkedAt: new Date(),
        },
      });
  }
  return rows.length;
}

export async function deleteAllCoverage() {
  await db.delete(instrumentDayCoverage);
}
