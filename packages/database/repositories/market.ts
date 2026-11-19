import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import {
  dataQualityIssues,
  exchanges,
  instruments,
  marketCandles1m,
  marketDataCoverage,
  marketDataIngestionRuns,
  marketQuoteSnapshots,
  providers,
} from '../schema/index.js';

export async function createIngestionRun(values: {
  providerId: string;
  runType: string;
  instrumentId: string | null;
  timeframeUnit: string | null;
  timeframeInterval: number | null;
  requestedFrom: string | null;
  requestedTo: string | null;
  status?: string;
  parentJobRunId?: string | null;
  chunkIndex?: number | null;
  chunkCount?: number | null;
  attempt?: number;
  requestFingerprint?: string | null;
}) {
  const [created] = await db
    .insert(marketDataIngestionRuns)
    .values({
      id: uuidv7(),
      providerId: values.providerId,
      runType: values.runType,
      instrumentId: values.instrumentId,
      timeframeUnit: values.timeframeUnit,
      timeframeInterval: values.timeframeInterval,
      requestedFrom: values.requestedFrom,
      requestedTo: values.requestedTo,
      status: values.status ?? 'queued',
      rowsFetched: 0,
      rowsWritten: 0,
      rowsRejected: 0,
      rowsSkipped: 0,
      rowsUpdated: 0,
      parentJobRunId: values.parentJobRunId ?? null,
      chunkIndex: values.chunkIndex ?? null,
      chunkCount: values.chunkCount ?? null,
      attempt: values.attempt ?? 1,
      requestFingerprint: values.requestFingerprint ?? null,
      startedAt: null,
      finishedAt: null,
    })
    .returning();
  return created;
}

export async function updateIngestionRun(
  id: string,
  values: {
    status: string;
    rowsFetched?: number;
    rowsWritten?: number;
    rowsRejected?: number;
    rowsSkipped?: number;
    rowsUpdated?: number;
    errorMessage?: string | null;
    rawPayloadId?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    httpStatus?: number | null;
    providerErrorCode?: string | null;
    durationMs?: number | null;
    rateLimitedUntil?: Date | null;
    attempt?: number;
  },
) {
  const [updated] = await db
    .update(marketDataIngestionRuns)
    .set(values)
    .where(eq(marketDataIngestionRuns.id, id))
    .returning();
  return updated;
}

export async function listQualityIssues(filters: {
  status?: string;
  severity?: string;
  instrumentId?: string;
  providerWideOnly?: boolean;
  limit?: number;
}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(dataQualityIssues.status, filters.status));
  if (filters.severity) conditions.push(eq(dataQualityIssues.severity, filters.severity));
  if (filters.instrumentId)
    conditions.push(eq(dataQualityIssues.instrumentId, filters.instrumentId));
  if (filters.providerWideOnly)
    conditions.push(isNull(dataQualityIssues.instrumentId));

  return db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dataQualityIssues.detectedAt))
    .limit(filters.limit ?? 200);
}

export async function createQualityIssue(values: {
  providerId: string | null;
  instrumentId: string | null;
  issueType: string;
  severity: string;
  tradingDate: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  details: Record<string, unknown>;
  detectedBy: string;
}) {
  const [created] = await db
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
    })
    .returning();
  return created;
}

export async function upsertCandles(rows: (typeof marketCandles1m.$inferInsert)[]) {
  if (rows.length === 0) return 0;
  await db
    .insert(marketCandles1m)
    .values(rows)
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
  return rows.length;
}

export async function listCandles(filters: {
  instrumentId: string;
  from: Date;
  to: Date;
  limit?: number;
}) {
  return db
    .select({
      instrumentId: marketCandles1m.instrumentId,
      candleStart: marketCandles1m.candleStart,
      tradingDate: marketCandles1m.tradingDate,
      open: marketCandles1m.open,
      high: marketCandles1m.high,
      low: marketCandles1m.low,
      close: marketCandles1m.close,
      volume: marketCandles1m.volume,
      isFinal: marketCandles1m.isFinal,
    })
    .from(marketCandles1m)
    .where(
      and(
        eq(marketCandles1m.instrumentId, filters.instrumentId),
        gte(marketCandles1m.candleStart, filters.from),
        lte(marketCandles1m.candleStart, filters.to),
      ),
    )
    .orderBy(asc(marketCandles1m.candleStart))
    .limit(filters.limit ?? 5000);
}

export async function latestCandleAt(instrumentId: string) {
  const rows = await db
    .select({ candleStart: marketCandles1m.candleStart })
    .from(marketCandles1m)
    .where(eq(marketCandles1m.instrumentId, instrumentId))
    .orderBy(desc(marketCandles1m.candleStart))
    .limit(1);
  return rows[0]?.candleStart ?? null;
}

export async function upsertCoverage(values: {
  instrumentId: string;
  tradingDate: string;
  expectedBars: number;
  storedBars: number;
  gapCount: number;
  gapRunCount?: number;
  maxGapMinutes?: number;
  firstBarAt: Date | null;
  lastBarAt: Date | null;
  status: string;
  details?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(marketDataCoverage)
    .values({
      id: uuidv7(),
      instrumentId: values.instrumentId,
      tradingDate: values.tradingDate,
      expectedBars: values.expectedBars,
      storedBars: values.storedBars,
      gapCount: values.gapCount,
      gapRunCount: values.gapRunCount ?? 0,
      maxGapMinutes: values.maxGapMinutes ?? 0,
      firstBarAt: values.firstBarAt,
      lastBarAt: values.lastBarAt,
      status: values.status,
      details: values.details ?? {},
      checkedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [marketDataCoverage.instrumentId, marketDataCoverage.tradingDate],
      set: {
        expectedBars: values.expectedBars,
        storedBars: values.storedBars,
        gapCount: values.gapCount,
        gapRunCount: values.gapRunCount ?? 0,
        maxGapMinutes: values.maxGapMinutes ?? 0,
        firstBarAt: values.firstBarAt,
        lastBarAt: values.lastBarAt,
        status: values.status,
        details: values.details ?? {},
        checkedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function upsertQuoteSnapshots(rows: (typeof marketQuoteSnapshots.$inferInsert)[]) {
  if (rows.length === 0) return 0;
  await db
    .insert(marketQuoteSnapshots)
    .values(rows)
    .onConflictDoUpdate({
      target: [marketQuoteSnapshots.instrumentId, marketQuoteSnapshots.capturedAt],
      set: {
        lastPrice: sql`excluded.last_price`,
        averagePrice: sql`excluded.average_price`,
        open: sql`excluded.open`,
        high: sql`excluded.high`,
        low: sql`excluded.low`,
        close: sql`excluded.close`,
        volume: sql`excluded.volume`,
        bestBidPrice: sql`excluded.best_bid_price`,
        bestBidQuantity: sql`excluded.best_bid_quantity`,
        bestAskPrice: sql`excluded.best_ask_price`,
        bestAskQuantity: sql`excluded.best_ask_quantity`,
        totalBuyQuantity: sql`excluded.total_buy_quantity`,
        totalSellQuantity: sql`excluded.total_sell_quantity`,
        lowerCircuitLimit: sql`excluded.lower_circuit_limit`,
        upperCircuitLimit: sql`excluded.upper_circuit_limit`,
        netChange: sql`excluded.net_change`,
        sourceProviderId: sql`excluded.source_provider_id`,
        rawPayloadId: sql`excluded.raw_payload_id`,
      },
    });
  return rows.length;
}

export async function refreshDailyStats() {
  await db.execute(sql`select refresh_instrument_daily_stats()`);
}

export async function ensureMarketPartitions(monthsAhead = 5) {
  await db.execute(sql`select ensure_market_partitions(${monthsAhead})`);
}

export async function computeCoverageForInstrument(instrumentId: string, from: string, to: string) {
  return db
    .select({
      tradingDate: marketCandles1m.tradingDate,
      storedBars: sql<number>`count(*)::int`,
      firstBarAt: sql<Date | null>`min(${marketCandles1m.candleStart})`,
      lastBarAt: sql<Date | null>`max(${marketCandles1m.candleStart})`,
    })
    .from(marketCandles1m)
    .where(
      and(
        eq(marketCandles1m.instrumentId, instrumentId),
        gte(marketCandles1m.tradingDate, from),
        lte(marketCandles1m.tradingDate, to),
      ),
    )
    .groupBy(marketCandles1m.tradingDate)
    .orderBy(asc(marketCandles1m.tradingDate));
}

export async function getExpectedBarsForDate(exchangeCode: string, date: string) {
  const rows = await db.execute<{ minutes: number | null; is_trading_day: boolean | null }>(sql`
    select
      extract(epoch from (tc.session_close - tc.session_open)) / 60 as minutes,
      tc.is_trading_day
    from trading_calendar tc
    join exchanges e on e.id = tc.exchange_id
    where e.code = ${exchangeCode} and tc.trading_date = ${date}
    limit 1
  `);
  const row = rows[0];
  if (!row || !row.is_trading_day) return 0;
  return Math.max(0, Math.round(Number(row.minutes ?? 0)));
}

export async function getInstrumentExchangeCode(instrumentId: string) {
  const rows = await db
    .select({ exchangeCode: exchanges.code })
    .from(instruments)
    .innerJoin(exchanges, eq(exchanges.id, instruments.exchangeId))
    .where(eq(instruments.id, instrumentId))
    .limit(1);
  return rows[0]?.exchangeCode ?? null;
}
