import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import {
  dataQualityIssues,
  exchanges,
  instrumentDataStatus,
  instrumentProviderMappings,
  instrumentUniverseMembers,
  instrumentUniverseVersions,
  instrumentUniverses,
  instruments,
  jobRuns,
  marketCandles1m,
  marketDataCoverage,
  marketDataDailyValidation,
  marketDataIngestionRuns,
  providers,
  rawProviderPayloads,
} from '../schema/index.js';

type CandleInsert = InferInsertModel<typeof marketCandles1m>;

export async function findIngestionRun(id: string) {
  const rows = await db
    .select()
    .from(marketDataIngestionRuns)
    .where(eq(marketDataIngestionRuns.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findActiveBackfillRun(instrumentId: string) {
  const rows = await db
    .select()
    .from(marketDataIngestionRuns)
    .where(
      and(
        eq(marketDataIngestionRuns.instrumentId, instrumentId),
        eq(marketDataIngestionRuns.runType, 'historical_backfill'),
        inArray(marketDataIngestionRuns.status, ['queued', 'running']),
      ),
    )
    .orderBy(desc(marketDataIngestionRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function findActiveBackfillRuns(instrumentIds: string[]) {
  if (instrumentIds.length === 0) return [];
  return db
    .select()
    .from(marketDataIngestionRuns)
    .where(
      and(
        inArray(marketDataIngestionRuns.instrumentId, instrumentIds),
        eq(marketDataIngestionRuns.runType, 'historical_backfill'),
        inArray(marketDataIngestionRuns.status, ['queued', 'running']),
      ),
    );
}

export async function findChunk(input: {
  parentJobRunId: string;
  instrumentId: string;
  chunkIndex: number;
}) {
  const rows = await db
    .select()
    .from(marketDataIngestionRuns)
    .where(
      and(
        eq(marketDataIngestionRuns.parentJobRunId, input.parentJobRunId),
        eq(marketDataIngestionRuns.instrumentId, input.instrumentId),
        eq(marketDataIngestionRuns.chunkIndex, input.chunkIndex),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findSucceededChunk(input: {
  parentJobRunId: string;
  instrumentId: string;
  from: string;
  to: string;
}) {
  const rows = await db
    .select()
    .from(marketDataIngestionRuns)
    .where(
      and(
        eq(marketDataIngestionRuns.parentJobRunId, input.parentJobRunId),
        eq(marketDataIngestionRuns.instrumentId, input.instrumentId),
        eq(marketDataIngestionRuns.requestedFrom, input.from),
        eq(marketDataIngestionRuns.requestedTo, input.to),
        eq(marketDataIngestionRuns.status, 'succeeded'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listRunningChunksOlderThan(minutes: number) {
  return db
    .select()
    .from(marketDataIngestionRuns)
    .where(
      and(
        eq(marketDataIngestionRuns.status, 'running'),
        isNotNull(marketDataIngestionRuns.startedAt),
        sql`${marketDataIngestionRuns.startedAt} < now() - (${minutes} || ' minutes')::interval`,
      ),
    );
}

export async function markStaleRunsFailed(minutes: number) {
  const stale = await listRunningChunksOlderThan(minutes);
  if (stale.length === 0) return [];
  await db
    .update(marketDataIngestionRuns)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      errorMessage: `Stale run recovered after ${minutes} minutes without a heartbeat`,
    })
    .where(
      and(
        eq(marketDataIngestionRuns.status, 'running'),
        inArray(
          marketDataIngestionRuns.id,
          stale.map((row) => row.id),
        ),
      ),
    );
  return stale;
}

export async function getParentPlanProgress(parentJobRunId: string) {
  const [counts] = await db
    .select({
      chunks: sql<number>`count(*)::int`,
      instruments: sql<number>`count(distinct ${marketDataIngestionRuns.instrumentId})::int`,
      queued: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'queued')::int`,
      running: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'running')::int`,
      succeeded: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'succeeded')::int`,
      partiallyFailed: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'partially_failed')::int`,
      failed: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'failed')::int`,
      cancelled: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'cancelled')::int`,
      rowsFetched: sql<number>`coalesce(sum(${marketDataIngestionRuns.rowsFetched}), 0)::int`,
      rowsWritten: sql<number>`coalesce(sum(${marketDataIngestionRuns.rowsWritten}), 0)::int`,
      rowsRejected: sql<number>`coalesce(sum(${marketDataIngestionRuns.rowsRejected}), 0)::int`,
      rowsSkipped: sql<number>`coalesce(sum(${marketDataIngestionRuns.rowsSkipped}), 0)::int`,
      rowsUpdated: sql<number>`coalesce(sum(${marketDataIngestionRuns.rowsUpdated}), 0)::int`,
    })
    .from(marketDataIngestionRuns)
    .where(eq(marketDataIngestionRuns.parentJobRunId, parentJobRunId));
  return (
    counts ?? {
      chunks: 0,
      instruments: 0,
      queued: 0,
      running: 0,
      succeeded: 0,
      partiallyFailed: 0,
      failed: 0,
      cancelled: 0,
      rowsFetched: 0,
      rowsWritten: 0,
      rowsRejected: 0,
      rowsSkipped: 0,
      rowsUpdated: 0,
    }
  );
}

export async function listBackfillPlans(limit = 50) {
  const plans = await db
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.jobName, 'backfill-plan'), eq(jobRuns.jobType, 'ingestion')))
    .orderBy(desc(jobRuns.createdAt))
    .limit(limit);
  return Promise.all(
    plans.map(async (plan) => ({
      ...plan,
      progress: await getParentPlanProgress(plan.id),
    })),
  );
}

export async function getBackfillPlanDetail(id: string) {
  const rows = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);
  const plan = rows[0];
  if (!plan) return null;
  const progress = await getParentPlanProgress(id);
  const chunks = await db
    .select({
      id: marketDataIngestionRuns.id,
      instrumentId: marketDataIngestionRuns.instrumentId,
      symbol: instruments.tradingSymbol,
      rank: sql<number | null>`(
        select m.rank from instrument_universe_members m
        join instrument_universe_versions v on v.id = m.universe_version_id
        join instrument_universes u on u.id = v.universe_id
        where m.instrument_id = "market_data_ingestion_runs"."instrument_id"
          and u.code = 'nifty-50'
          and v.effective_to is null
        limit 1
      )`,
      chunkIndex: marketDataIngestionRuns.chunkIndex,
      chunkCount: marketDataIngestionRuns.chunkCount,
      requestedFrom: marketDataIngestionRuns.requestedFrom,
      requestedTo: marketDataIngestionRuns.requestedTo,
      status: marketDataIngestionRuns.status,
      attempt: marketDataIngestionRuns.attempt,
      rowsFetched: marketDataIngestionRuns.rowsFetched,
      rowsWritten: marketDataIngestionRuns.rowsWritten,
      rowsRejected: marketDataIngestionRuns.rowsRejected,
      rowsSkipped: marketDataIngestionRuns.rowsSkipped,
      rowsUpdated: marketDataIngestionRuns.rowsUpdated,
      httpStatus: marketDataIngestionRuns.httpStatus,
      providerErrorCode: marketDataIngestionRuns.providerErrorCode,
      durationMs: marketDataIngestionRuns.durationMs,
      errorMessage: marketDataIngestionRuns.errorMessage,
      startedAt: marketDataIngestionRuns.startedAt,
      finishedAt: marketDataIngestionRuns.finishedAt,
    })
    .from(marketDataIngestionRuns)
    .leftJoin(instruments, eq(instruments.id, marketDataIngestionRuns.instrumentId))
    .where(eq(marketDataIngestionRuns.parentJobRunId, id))
    .orderBy(asc(marketDataIngestionRuns.instrumentId), asc(marketDataIngestionRuns.chunkIndex));
  return { ...plan, progress, chunks };
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
            ingestionRunId: sql`excluded.ingestion_run_id`,
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

export async function getStoredCandleStarts(instrumentId: string, tradingDate: string) {
  return db
    .select({
      candleStart: marketCandles1m.candleStart,
      volume: marketCandles1m.volume,
      isFinal: marketCandles1m.isFinal,
    })
    .from(marketCandles1m)
    .where(
      and(
        eq(marketCandles1m.instrumentId, instrumentId),
        eq(marketCandles1m.tradingDate, tradingDate),
      ),
    )
    .orderBy(asc(marketCandles1m.candleStart));
}

export async function getMinuteAggregate(instrumentId: string, tradingDate: string) {
  const rows = await db.execute<{
    open: string | null;
    high: string | null;
    low: string | null;
    close: string | null;
    volume: string | null;
    bars: number;
  }>(sql`
    select
      (array_agg(${marketCandles1m.open} order by ${marketCandles1m.candleStart}))[1]::text as open,
      max(${marketCandles1m.high})::text as high,
      min(${marketCandles1m.low})::text as low,
      (array_agg(${marketCandles1m.close} order by ${marketCandles1m.candleStart} desc))[1]::text as close,
      coalesce(sum(${marketCandles1m.volume}), 0)::text as volume,
      count(*)::int as bars
    from ${marketCandles1m}
    where ${marketCandles1m.instrumentId} = ${instrumentId}
      and ${marketCandles1m.tradingDate} = ${tradingDate}
  `);
  return rows[0] ?? { open: null, high: null, low: null, close: null, volume: '0', bars: 0 };
}

export async function upsertDailyValidation(values: {
  instrumentId: string;
  tradingDate: string;
  sourceProviderId: string;
  dailyOpen: string | null;
  dailyHigh: string | null;
  dailyLow: string | null;
  dailyClose: string | null;
  dailyVolume: string | null;
  minuteOpen: string | null;
  minuteHigh: string | null;
  minuteLow: string | null;
  minuteClose: string | null;
  minuteVolume: string | null;
  volumeDeltaPct: string | null;
  ohlcMatch: boolean | null;
  volumeMatch: boolean | null;
  status: string;
  ingestionRunId: string | null;
  rawPayloadId: string | null;
}) {
  const [row] = await db
    .insert(marketDataDailyValidation)
    .values({ id: uuidv7(), ...values, checkedAt: new Date() })
    .onConflictDoUpdate({
      target: [
        marketDataDailyValidation.instrumentId,
        marketDataDailyValidation.tradingDate,
        marketDataDailyValidation.sourceProviderId,
      ],
      set: {
        dailyOpen: values.dailyOpen,
        dailyHigh: values.dailyHigh,
        dailyLow: values.dailyLow,
        dailyClose: values.dailyClose,
        dailyVolume: values.dailyVolume,
        minuteOpen: values.minuteOpen,
        minuteHigh: values.minuteHigh,
        minuteLow: values.minuteLow,
        minuteClose: values.minuteClose,
        minuteVolume: values.minuteVolume,
        volumeDeltaPct: values.volumeDeltaPct,
        ohlcMatch: values.ohlcMatch,
        volumeMatch: values.volumeMatch,
        status: values.status,
        ingestionRunId: values.ingestionRunId,
        rawPayloadId: values.rawPayloadId,
        checkedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function listDailyValidation(filters: {
  instrumentId?: string;
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters.instrumentId)
    conditions.push(eq(marketDataDailyValidation.instrumentId, filters.instrumentId));
  if (filters.from) conditions.push(gte(marketDataDailyValidation.tradingDate, filters.from));
  if (filters.to) conditions.push(lte(marketDataDailyValidation.tradingDate, filters.to));
  if (filters.status) conditions.push(eq(marketDataDailyValidation.status, filters.status));
  return db
    .select({
      id: marketDataDailyValidation.id,
      instrumentId: marketDataDailyValidation.instrumentId,
      symbol: instruments.tradingSymbol,
      tradingDate: marketDataDailyValidation.tradingDate,
      status: marketDataDailyValidation.status,
      ohlcMatch: marketDataDailyValidation.ohlcMatch,
      volumeMatch: marketDataDailyValidation.volumeMatch,
      dailyVolume: marketDataDailyValidation.dailyVolume,
      minuteVolume: marketDataDailyValidation.minuteVolume,
      volumeDeltaPct: marketDataDailyValidation.volumeDeltaPct,
      checkedAt: marketDataDailyValidation.checkedAt,
    })
    .from(marketDataDailyValidation)
    .innerJoin(instruments, eq(instruments.id, marketDataDailyValidation.instrumentId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(marketDataDailyValidation.tradingDate))
    .limit(Math.min(filters.limit ?? 500, 2000));
}

export async function getCoverageDayDetail(instrumentId: string, date: string) {
  const coverage = await db
    .select()
    .from(marketDataCoverage)
    .where(
      and(
        eq(marketDataCoverage.instrumentId, instrumentId),
        eq(marketDataCoverage.tradingDate, date),
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
  const validation = await db
    .select()
    .from(marketDataDailyValidation)
    .where(
      and(
        eq(marketDataDailyValidation.instrumentId, instrumentId),
        eq(marketDataDailyValidation.tradingDate, date),
      ),
    )
    .orderBy(desc(marketDataDailyValidation.checkedAt))
    .limit(1);
  const issues = await db
    .select()
    .from(dataQualityIssues)
    .where(
      and(
        eq(dataQualityIssues.instrumentId, instrumentId),
        eq(dataQualityIssues.tradingDate, date),
      ),
    )
    .orderBy(desc(dataQualityIssues.lastSeenAt))
    .limit(25);
  return {
    instrument: instrument[0] ?? null,
    coverage: coverage[0] ?? null,
    validation: validation[0] ?? null,
    issues,
  };
}

export async function getCoverageHeatmap(filters: {
  from: string;
  to: string;
  universeCode?: string;
  limit?: number;
}) {
  const universeCode = filters.universeCode ?? 'nifty-50';
  return db
    .select({
      instrumentId: marketDataCoverage.instrumentId,
      symbol: instruments.tradingSymbol,
      rank: instrumentUniverseMembers.rank,
      tradingDate: marketDataCoverage.tradingDate,
      status: marketDataCoverage.status,
      validationStatus: marketDataCoverage.validationStatus,
      gapCount: marketDataCoverage.gapCount,
      gapRunCount: marketDataCoverage.gapRunCount,
      maxGapMinutes: marketDataCoverage.maxGapMinutes,
    })
    .from(marketDataCoverage)
    .innerJoin(instruments, eq(instruments.id, marketDataCoverage.instrumentId))
    .innerJoin(
      instrumentUniverseMembers,
      eq(instrumentUniverseMembers.instrumentId, marketDataCoverage.instrumentId),
    )
    .innerJoin(
      instrumentUniverseVersions,
      eq(instrumentUniverseVersions.id, instrumentUniverseMembers.universeVersionId),
    )
    .innerJoin(
      instrumentUniverses,
      eq(instrumentUniverses.id, instrumentUniverseVersions.universeId),
    )
    .where(
      and(
        eq(instrumentUniverses.code, universeCode),
        sql`${instrumentUniverseVersions.effectiveTo} is null`,
        gte(marketDataCoverage.tradingDate, filters.from),
        lte(marketDataCoverage.tradingDate, filters.to),
      ),
    )
    .orderBy(asc(instrumentUniverseMembers.rank), asc(marketDataCoverage.tradingDate))
    .limit(Math.min(filters.limit ?? 2000, 5000));
}

export async function getIngestionRunDetail(id: string) {
  const rows = await db
    .select({
      id: marketDataIngestionRuns.id,
      providerId: marketDataIngestionRuns.providerId,
      providerCode: providers.code,
      runType: marketDataIngestionRuns.runType,
      instrumentId: marketDataIngestionRuns.instrumentId,
      symbol: instruments.tradingSymbol,
      timeframeUnit: marketDataIngestionRuns.timeframeUnit,
      timeframeInterval: marketDataIngestionRuns.timeframeInterval,
      requestedFrom: marketDataIngestionRuns.requestedFrom,
      requestedTo: marketDataIngestionRuns.requestedTo,
      status: marketDataIngestionRuns.status,
      rowsFetched: marketDataIngestionRuns.rowsFetched,
      rowsWritten: marketDataIngestionRuns.rowsWritten,
      rowsRejected: marketDataIngestionRuns.rowsRejected,
      rowsSkipped: marketDataIngestionRuns.rowsSkipped,
      rowsUpdated: marketDataIngestionRuns.rowsUpdated,
      parentJobRunId: marketDataIngestionRuns.parentJobRunId,
      chunkIndex: marketDataIngestionRuns.chunkIndex,
      chunkCount: marketDataIngestionRuns.chunkCount,
      attempt: marketDataIngestionRuns.attempt,
      requestFingerprint: marketDataIngestionRuns.requestFingerprint,
      httpStatus: marketDataIngestionRuns.httpStatus,
      providerErrorCode: marketDataIngestionRuns.providerErrorCode,
      durationMs: marketDataIngestionRuns.durationMs,
      rateLimitedUntil: marketDataIngestionRuns.rateLimitedUntil,
      errorMessage: marketDataIngestionRuns.errorMessage,
      rawPayloadId: marketDataIngestionRuns.rawPayloadId,
      startedAt: marketDataIngestionRuns.startedAt,
      finishedAt: marketDataIngestionRuns.finishedAt,
      createdAt: marketDataIngestionRuns.createdAt,
    })
    .from(marketDataIngestionRuns)
    .innerJoin(providers, eq(providers.id, marketDataIngestionRuns.providerId))
    .leftJoin(instruments, eq(instruments.id, marketDataIngestionRuns.instrumentId))
    .where(eq(marketDataIngestionRuns.id, id))
    .limit(1);
  const run = rows[0];
  if (!run) return null;
  const payload = run.rawPayloadId
    ? ((
        await db
          .select({
            id: rawProviderPayloads.id,
            endpoint: rawProviderPayloads.endpoint,
            httpStatus: rawProviderPayloads.httpStatus,
            payloadBytes: rawProviderPayloads.payloadBytes,
            payloadSha256: rawProviderPayloads.payloadSha256,
            fetchedAt: rawProviderPayloads.fetchedAt,
            retentionClass: rawProviderPayloads.retentionClass,
            expiresAt: rawProviderPayloads.expiresAt,
          })
          .from(rawProviderPayloads)
          .where(eq(rawProviderPayloads.id, run.rawPayloadId))
          .limit(1)
      )[0] ?? null)
    : null;
  return { ...run, rawPayload: payload };
}

export async function getQualityIssue(id: string) {
  const rows = await db
    .select({
      id: dataQualityIssues.id,
      providerId: dataQualityIssues.providerId,
      providerCode: providers.code,
      instrumentId: dataQualityIssues.instrumentId,
      symbol: instruments.tradingSymbol,
      issueType: dataQualityIssues.issueType,
      severity: dataQualityIssues.severity,
      tradingDate: dataQualityIssues.tradingDate,
      windowStart: dataQualityIssues.windowStart,
      windowEnd: dataQualityIssues.windowEnd,
      details: dataQualityIssues.details,
      status: dataQualityIssues.status,
      detectedBy: dataQualityIssues.detectedBy,
      detectedAt: dataQualityIssues.detectedAt,
      resolvedAt: dataQualityIssues.resolvedAt,
      ruleId: dataQualityIssues.ruleId,
      dedupeKey: dataQualityIssues.dedupeKey,
      occurrenceCount: dataQualityIssues.occurrenceCount,
      lastSeenAt: dataQualityIssues.lastSeenAt,
      acknowledgedBy: dataQualityIssues.acknowledgedBy,
      acknowledgedAt: dataQualityIssues.acknowledgedAt,
      resolvedBy: dataQualityIssues.resolvedBy,
      resolutionNote: dataQualityIssues.resolutionNote,
    })
    .from(dataQualityIssues)
    .leftJoin(providers, eq(providers.id, dataQualityIssues.providerId))
    .leftJoin(instruments, eq(instruments.id, dataQualityIssues.instrumentId))
    .where(eq(dataQualityIssues.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertQualityIssue(values: {
  providerId: string | null;
  instrumentId: string | null;
  issueType: string;
  severity: string;
  tradingDate: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  details: Record<string, unknown>;
  detectedBy: string;
  ruleId: string;
  dedupeKey: string;
}) {
  const [row] = await db
    .insert(dataQualityIssues)
    .values({
      id: uuidv7(),
      providerId: values.providerId,
      instrumentId: values.instrumentId,
      issueType: values.issueType,
      severity: values.severity,
      tradingDate: values.tradingDate,
      windowStart: values.windowStart,
      windowEnd: values.windowEnd,
      details: values.details,
      status: 'open',
      detectedBy: values.detectedBy,
      ruleId: values.ruleId,
      dedupeKey: values.dedupeKey,
      occurrenceCount: 1,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dataQualityIssues.dedupeKey,
      targetWhere: sql`${dataQualityIssues.status} in ('open','acknowledged') and ${dataQualityIssues.dedupeKey} is not null`,
      set: {
        occurrenceCount: sql`${dataQualityIssues.occurrenceCount} + 1`,
        lastSeenAt: new Date(),
        severity: sql`excluded.severity`,
        details: sql`${dataQualityIssues.details} || excluded.details`,
        ruleId: sql`excluded.rule_id`,
      },
    })
    .returning();
  return row;
}

export async function transitionQualityIssue(values: {
  id: string;
  status: 'acknowledged' | 'resolved' | 'ignored';
  note?: string | null;
  actorUserId: string | null;
}) {
  if ((values.status === 'resolved' || values.status === 'ignored') && !values.note?.trim()) {
    throw new Error('A resolution note is required for resolved or ignored issues');
  }
  const now = new Date();
  const set: Record<string, unknown> = {
    status: values.status,
    resolvedAt: values.status === 'resolved' || values.status === 'ignored' ? now : null,
  };
  if (values.status === 'acknowledged') {
    set.acknowledgedBy = values.actorUserId;
    set.acknowledgedAt = now;
  }
  if (values.status === 'resolved' || values.status === 'ignored') {
    set.resolvedBy = values.actorUserId;
  }
  if (values.note) set.resolutionNote = values.note;
  const [row] = await db
    .update(dataQualityIssues)
    .set(set)
    .where(eq(dataQualityIssues.id, values.id))
    .returning();
  return row;
}

export async function autoResolveStaleIssues(olderThanHours: number) {
  const rows = await db
    .update(dataQualityIssues)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: null,
      resolutionNote: `Auto-resolved after ${olderThanHours}h without a repeat finding`,
    })
    .where(
      and(
        eq(dataQualityIssues.status, 'open'),
        ne(dataQualityIssues.severity, 'critical'),
        sql`${dataQualityIssues.lastSeenAt} < now() - (${olderThanHours} || ' hours')::interval`,
      ),
    )
    .returning({ id: dataQualityIssues.id });
  return rows.length;
}

export async function getProviderStatus() {
  const [runs] = await db
    .select({
      lastSuccessfulSyncAt: sql<
        string | null
      >`max(${marketDataIngestionRuns.finishedAt}) filter (where ${marketDataIngestionRuns.runType} = 'instrument_master' and ${marketDataIngestionRuns.status} = 'succeeded')::text`,
      lastSuccessfulBackfillAt: sql<
        string | null
      >`max(${marketDataIngestionRuns.finishedAt}) filter (where ${marketDataIngestionRuns.runType} = 'historical_backfill' and ${marketDataIngestionRuns.status} = 'succeeded')::text`,
      lastSuccessfulIntradayAt: sql<
        string | null
      >`max(${marketDataIngestionRuns.finishedAt}) filter (where ${marketDataIngestionRuns.runType} = 'intraday_sync' and ${marketDataIngestionRuns.status} = 'succeeded')::text`,
      lastSuccessfulValidationAt: sql<
        string | null
      >`max(${marketDataIngestionRuns.finishedAt}) filter (where ${marketDataIngestionRuns.runType} = 'daily_validation' and ${marketDataIngestionRuns.status} = 'succeeded')::text`,
      failedRuns24h: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'failed' and ${marketDataIngestionRuns.createdAt} >= now() - interval '24 hours')::int`,
      runningChunks: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'running')::int`,
      queuedChunks: sql<number>`count(*) filter (where ${marketDataIngestionRuns.status} = 'queued')::int`,
    })
    .from(marketDataIngestionRuns);
  const [payloads] = await db
    .select({
      payloadCount: sql<number>`count(*)::int`,
      payloadBytes: sql<number>`coalesce(sum(${rawProviderPayloads.payloadBytes}), 0)::bigint`,
      oldestPayloadAt: sql<string | null>`min(${rawProviderPayloads.fetchedAt})::text`,
    })
    .from(rawProviderPayloads);
  return { ...runs, ...payloads };
}

export async function getCatalogSummary(universeCode = 'nifty-50') {
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
      partialReconciled: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'partial_reconciled')::int`,
      partialMismatch: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'partial_mismatch')::int`,
      missing: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'missing')::int`,
      needsReview: sql<number>`count(*) filter (where ${instrumentDataStatus.dataStatus} = 'needs_review')::int`,
    })
    .from(instrumentUniverseMembers)
    .innerJoin(
      instrumentUniverseVersions,
      eq(instrumentUniverseVersions.id, instrumentUniverseMembers.universeVersionId),
    )
    .innerJoin(
      instrumentUniverses,
      eq(instrumentUniverses.id, instrumentUniverseVersions.universeId),
    )
    .leftJoin(
      instrumentDataStatus,
      eq(instrumentDataStatus.instrumentId, instrumentUniverseMembers.instrumentId),
    )
    .where(
      and(
        eq(instrumentUniverses.code, universeCode),
        sql`${instrumentUniverseVersions.effectiveTo} is null`,
      ),
    );
  return row ?? null;
}

export async function getUniverseMembersForBackfill(universeCode = 'nifty-50') {
  return db
    .select({
      instrumentId: instruments.id,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      rank: instrumentUniverseMembers.rank,
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
    .from(instrumentUniverseMembers)
    .innerJoin(
      instrumentUniverseVersions,
      eq(instrumentUniverseVersions.id, instrumentUniverseMembers.universeVersionId),
    )
    .innerJoin(
      instrumentUniverses,
      eq(instrumentUniverses.id, instrumentUniverseVersions.universeId),
    )
    .innerJoin(instruments, eq(instruments.id, instrumentUniverseMembers.instrumentId))
    .where(
      and(
        eq(instrumentUniverses.code, universeCode),
        sql`${instrumentUniverseVersions.effectiveTo} is null`,
      ),
    )
    .orderBy(asc(instrumentUniverseMembers.rank));
}

export async function getInstrumentIdsForUniverse(universeCode = 'nifty-50') {
  const rows = await getUniverseMembersForBackfill(universeCode);
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
    .select({ date: sql<string | null>`max(${marketDataCoverage.tradingDate})::text` })
    .from(marketDataCoverage);
  return row?.date ?? null;
}

export async function getOpenCriticalIssueCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dataQualityIssues)
    .where(
      and(
        eq(dataQualityIssues.severity, 'critical'),
        inArray(dataQualityIssues.status, ['open', 'acknowledged']),
      ),
    );
  return row?.count ?? 0;
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

export async function getLastSuccessfulRunForInstrument(instrumentId: string) {
  const rows = await db
    .select()
    .from(marketDataIngestionRuns)
    .where(
      and(
        eq(marketDataIngestionRuns.instrumentId, instrumentId),
        eq(marketDataIngestionRuns.status, 'succeeded'),
      ),
    )
    .orderBy(desc(marketDataIngestionRuns.finishedAt))
    .limit(1);
  return rows[0] ?? null;
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

export async function listPlanChunks(parentJobRunId: string) {
  return db
    .select()
    .from(marketDataIngestionRuns)
    .where(eq(marketDataIngestionRuns.parentJobRunId, parentJobRunId))
    .orderBy(asc(marketDataIngestionRuns.instrumentId), asc(marketDataIngestionRuns.chunkIndex));
}

export async function getPlanJob(id: string) {
  const rows = await db.select().from(jobRuns).where(eq(jobRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getDailyValidation(instrumentId: string, tradingDate: string) {
  const rows = await db
    .select()
    .from(marketDataDailyValidation)
    .where(
      and(
        eq(marketDataDailyValidation.instrumentId, instrumentId),
        eq(marketDataDailyValidation.tradingDate, tradingDate),
      ),
    )
    .orderBy(desc(marketDataDailyValidation.checkedAt))
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

export async function getLatestRunForInstrument(instrumentId: string) {
  const rows = await db
    .select()
    .from(marketDataIngestionRuns)
    .where(eq(marketDataIngestionRuns.instrumentId, instrumentId))
    .orderBy(desc(marketDataIngestionRuns.createdAt))
    .limit(1);
  return rows[0] ?? null;
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

export async function listChildJobRuns(parentJobRunId: string) {
  return db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.correlationId, parentJobRunId))
    .orderBy(asc(jobRuns.createdAt));
}

export async function getChunkRowsForInstrument(parentJobRunId: string, instrumentId: string) {
  return db
    .select()
    .from(marketDataIngestionRuns)
    .where(
      and(
        eq(marketDataIngestionRuns.parentJobRunId, parentJobRunId),
        eq(marketDataIngestionRuns.instrumentId, instrumentId),
      ),
    )
    .orderBy(asc(marketDataIngestionRuns.chunkIndex));
}

export async function getCoverageMonths(instrumentIds: string[], from: string, to: string) {
  if (instrumentIds.length === 0) return [];
  return db
    .select({
      instrumentId: marketDataCoverage.instrumentId,
      month: sql<string>`to_char(date_trunc('month', ${marketDataCoverage.tradingDate}), 'YYYY-MM')`,
      complete: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'complete')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(marketDataCoverage)
    .where(
      and(
        inArray(marketDataCoverage.instrumentId, instrumentIds),
        gte(marketDataCoverage.tradingDate, from),
        lte(marketDataCoverage.tradingDate, to),
      ),
    )
    .groupBy(
      marketDataCoverage.instrumentId,
      sql`date_trunc('month', ${marketDataCoverage.tradingDate})`,
    );
}

export async function isMonthComplete(instrumentId: string, from: string, to: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      complete: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'complete')::int`,
    })
    .from(marketDataCoverage)
    .where(
      and(
        eq(marketDataCoverage.instrumentId, instrumentId),
        gte(marketDataCoverage.tradingDate, from),
        lte(marketDataCoverage.tradingDate, to),
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
    stored_bars: number;
    first_bar_at: string | null;
    last_bar_at: string | null;
    has_partial: boolean;
    starts: (string | Date)[];
    minute_open: string | null;
    minute_high: string | null;
    minute_low: string | null;
    minute_close: string | null;
    minute_volume: string | null;
  }>(sql`
    select
      ${marketCandles1m.tradingDate}::text as trading_date,
      count(*)::int as stored_bars,
      min(${marketCandles1m.candleStart})::text as first_bar_at,
      max(${marketCandles1m.candleStart})::text as last_bar_at,
      bool_or(not ${marketCandles1m.isFinal}) as has_partial,
      json_agg(${marketCandles1m.candleStart} order by ${marketCandles1m.candleStart}) as starts,
      (array_agg(${marketCandles1m.open} order by ${marketCandles1m.candleStart}))[1]::text as minute_open,
      max(${marketCandles1m.high})::text as minute_high,
      min(${marketCandles1m.low})::text as minute_low,
      (array_agg(${marketCandles1m.close} order by ${marketCandles1m.candleStart} desc))[1]::text as minute_close,
      coalesce(sum(${marketCandles1m.volume}), 0)::text as minute_volume
    from ${marketCandles1m}
    where ${marketCandles1m.instrumentId} = ${instrumentId}
      and ${marketCandles1m.tradingDate} between ${from} and ${to}
    group by ${marketCandles1m.tradingDate}
    order by ${marketCandles1m.tradingDate}
  `);
}

export async function getDailyValidationsForRange(instrumentId: string, from: string, to: string) {
  return db
    .select()
    .from(marketDataDailyValidation)
    .where(
      and(
        eq(marketDataDailyValidation.instrumentId, instrumentId),
        gte(marketDataDailyValidation.tradingDate, from),
        lte(marketDataDailyValidation.tradingDate, to),
      ),
    );
}

export async function upsertCoverageBatch(rows: (typeof marketDataCoverage.$inferInsert)[]) {
  if (rows.length === 0) return 0;
  const batchSize = 500;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    await db
      .insert(marketDataCoverage)
      .values(batch)
      .onConflictDoUpdate({
        target: [marketDataCoverage.instrumentId, marketDataCoverage.tradingDate],
        set: {
          expectedBars: sql`excluded.expected_bars`,
          storedBars: sql`excluded.stored_bars`,
          gapCount: sql`excluded.gap_count`,
          gapRunCount: sql`excluded.gap_run_count`,
          maxGapMinutes: sql`excluded.max_gap_minutes`,
          firstBarAt: sql`excluded.first_bar_at`,
          lastBarAt: sql`excluded.last_bar_at`,
          status: sql`excluded.status`,
          dailyVolume: sql`excluded.daily_volume`,
          minuteVolume: sql`excluded.minute_volume`,
          volumeDeltaPct: sql`excluded.volume_delta_pct`,
          ohlcMatch: sql`excluded.ohlc_match`,
          validationStatus: sql`excluded.validation_status`,
          details: sql`excluded.details`,
          checkedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }
  return rows.length;
}
