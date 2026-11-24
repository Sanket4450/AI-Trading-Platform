import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import {
  accounts,
  configurationVersions,
  corporateActions,
  exchanges,
  instrumentDayCoverage,
  instruments,
  jobRuns,
  marketCandles1m,
  signals,
  strategies,
  strategyConfigBindings,
  strategyEvaluationResults,
  strategyEvaluationRuns,
  strategyVersions,
  tradingCalendar,
} from '../schema/index.js';

export const EVALUATION_ACTIVE_STATUSES = ['queued', 'running'] as const;

export interface EvaluationStatusFilters {
  status?: string[];
  fromDate?: string;
  toDate?: string;
}

export async function listActiveResearchAccounts() {
  return db
    .select({ id: accounts.id, code: accounts.code, mode: accounts.mode })
    .from(accounts)
    .where(and(eq(accounts.isActive, true), inArray(accounts.mode, ['offline', 'research'])));
}

export async function getNifty50IndexInstruments() {
  return db
    .select({
      id: instruments.id,
      symbol: instruments.tradingSymbol,
      exchange: exchanges.code,
      segment: instruments.segment,
      instrumentType: instruments.instrumentType,
      tickSize: instruments.tickSize,
      isActive: instruments.isActive,
    })
    .from(instruments)
    .innerJoin(exchanges, eq(exchanges.id, instruments.exchangeId))
    .where(
      and(
        eq(instruments.tradingSymbol, 'NIFTY 50'),
        eq(instruments.segment, 'NSE_INDEX'),
        eq(instruments.instrumentType, 'INDEX'),
        eq(exchanges.code, 'NSE'),
        eq(instruments.isActive, true),
      ),
    );
}

export async function findActiveEvaluationRun(strategyVersionId: string) {
  const rows = await db
    .select()
    .from(strategyEvaluationRuns)
    .where(
      and(
        eq(strategyEvaluationRuns.strategyVersionId, strategyVersionId),
        inArray(strategyEvaluationRuns.status, [...EVALUATION_ACTIVE_STATUSES]),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createEvaluationRunWithJob(values: {
  strategyVersionId: string;
  configurationVersionId: string;
  riskConfigurationVersionId: string | null;
  accountId: string;
  fromDate: string;
  toDate: string;
  initialCapital: string;
  universe: Record<string, unknown>;
  note: string | null;
  createdBy: string;
}) {
  return db.transaction(async (tx) => {
    const jobRunId = uuidv7();
    const evaluationRunId = uuidv7();

    const [jobRun] = await tx
      .insert(jobRuns)
      .values({
        id: jobRunId,
        jobName: 'strategy-evaluation',
        status: 'queued',
        payload: { evaluationRunId },
        attempt: 0,
        maxAttempts: 1,
      })
      .returning();

    const [run] = await tx
      .insert(strategyEvaluationRuns)
      .values({
        id: evaluationRunId,
        strategyVersionId: values.strategyVersionId,
        configurationVersionId: values.configurationVersionId,
        riskConfigurationVersionId: values.riskConfigurationVersionId,
        accountId: values.accountId,
        fromDate: values.fromDate,
        toDate: values.toDate,
        initialCapital: values.initialCapital,
        universe: values.universe,
        status: 'queued',
        note: values.note,
        jobRunId,
        createdBy: values.createdBy,
      })
      .returning();

    return { run, jobRun };
  });
}

export async function deleteEvaluationRunAndJob(evaluationRunId: string, jobRunId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(strategyEvaluationRuns).where(eq(strategyEvaluationRuns.id, evaluationRunId));
    await tx.delete(jobRuns).where(eq(jobRuns.id, jobRunId));
  });
}

export async function getEvaluationRun(id: string) {
  const rows = await db
    .select({
      id: strategyEvaluationRuns.id,
      strategyVersionId: strategyEvaluationRuns.strategyVersionId,
      configurationVersionId: strategyEvaluationRuns.configurationVersionId,
      riskConfigurationVersionId: strategyEvaluationRuns.riskConfigurationVersionId,
      accountId: strategyEvaluationRuns.accountId,
      fromDate: strategyEvaluationRuns.fromDate,
      toDate: strategyEvaluationRuns.toDate,
      initialCapital: strategyEvaluationRuns.initialCapital,
      universe: strategyEvaluationRuns.universe,
      status: strategyEvaluationRuns.status,
      note: strategyEvaluationRuns.note,
      jobRunId: strategyEvaluationRuns.jobRunId,
      error: strategyEvaluationRuns.error,
      createdBy: strategyEvaluationRuns.createdBy,
      createdAt: strategyEvaluationRuns.createdAt,
      startedAt: strategyEvaluationRuns.startedAt,
      finishedAt: strategyEvaluationRuns.finishedAt,
      strategyId: strategies.id,
      strategyCode: strategies.code,
      strategyName: strategies.name,
      version: strategyVersions.version,
      codeRef: strategyVersions.codeRef,
      parameterSchema: strategyVersions.parameterSchema,
      versionStatus: strategyVersions.status,
      parameterPayload: configurationVersions.payload,
      parameterVersion: configurationVersions.version,
      parameterHash: configurationVersions.payloadHash,
    })
    .from(strategyEvaluationRuns)
    .innerJoin(
      strategyVersions,
      eq(strategyVersions.id, strategyEvaluationRuns.strategyVersionId),
    )
    .innerJoin(strategies, eq(strategies.id, strategyVersions.strategyId))
    .innerJoin(
      configurationVersions,
      eq(configurationVersions.id, strategyEvaluationRuns.configurationVersionId),
    )
    .where(eq(strategyEvaluationRuns.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getEvaluationRunRiskConfiguration(runId: string) {
  const rows = await db
    .select({
      id: configurationVersions.id,
      version: configurationVersions.version,
      payload: configurationVersions.payload,
      payloadHash: configurationVersions.payloadHash,
      scopeKey: configurationVersions.scopeKey,
    })
    .from(strategyEvaluationRuns)
    .innerJoin(
      configurationVersions,
      eq(configurationVersions.id, strategyEvaluationRuns.riskConfigurationVersionId),
    )
    .where(eq(strategyEvaluationRuns.id, runId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listEvaluationRuns(filters: EvaluationStatusFilters & {
  strategyId?: string;
  strategyVersionId?: string;
  limit: number;
  offset: number;
}) {
  const conditions = [];
  if (filters.strategyId) conditions.push(eq(strategies.id, filters.strategyId));
  if (filters.strategyVersionId) {
    conditions.push(eq(strategyEvaluationRuns.strategyVersionId, filters.strategyVersionId));
  }
  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(strategyEvaluationRuns.status, filters.status));
  }
  if (filters.fromDate) conditions.push(gte(strategyEvaluationRuns.fromDate, filters.fromDate));
  if (filters.toDate) conditions.push(lte(strategyEvaluationRuns.toDate, filters.toDate));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: strategyEvaluationRuns.id,
        strategyVersionId: strategyEvaluationRuns.strategyVersionId,
        version: strategyVersions.version,
        codeRef: strategyVersions.codeRef,
        configurationVersionId: strategyEvaluationRuns.configurationVersionId,
        riskConfigurationVersionId: strategyEvaluationRuns.riskConfigurationVersionId,
        fromDate: strategyEvaluationRuns.fromDate,
        toDate: strategyEvaluationRuns.toDate,
        initialCapital: strategyEvaluationRuns.initialCapital,
        status: strategyEvaluationRuns.status,
        note: strategyEvaluationRuns.note,
        jobRunId: strategyEvaluationRuns.jobRunId,
        error: strategyEvaluationRuns.error,
        createdAt: strategyEvaluationRuns.createdAt,
        startedAt: strategyEvaluationRuns.startedAt,
        finishedAt: strategyEvaluationRuns.finishedAt,
        entries: sql<number>`(
          select count(*)::int from signals s
          where s.evaluation_run_id = ${strategyEvaluationRuns.id} and s.signal_type = 'entry'
        )`,
        exits: sql<number>`(
          select count(*)::int from signals s
          where s.evaluation_run_id = ${strategyEvaluationRuns.id}
            and s.signal_type in ('stop','target','eod')
        )`,
        instrumentDays: sql<number>`(
          select count(*)::int from strategy_evaluation_results r
          where r.evaluation_run_id = ${strategyEvaluationRuns.id}
        )`,
      })
      .from(strategyEvaluationRuns)
      .innerJoin(
        strategyVersions,
        eq(strategyVersions.id, strategyEvaluationRuns.strategyVersionId),
      )
      .innerJoin(strategies, eq(strategies.id, strategyVersions.strategyId))
      .where(where)
      .orderBy(desc(strategyEvaluationRuns.createdAt), desc(strategyEvaluationRuns.id))
      .limit(filters.limit)
      .offset(filters.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(strategyEvaluationRuns)
      .innerJoin(
        strategyVersions,
        eq(strategyVersions.id, strategyEvaluationRuns.strategyVersionId),
      )
      .innerJoin(strategies, eq(strategies.id, strategyVersions.strategyId))
      .where(where),
  ]);

  return { items, total: totalRows[0]?.total ?? 0 };
}

export async function getEvaluationRunSummary(runId: string) {
  const [row] = await db
    .select({
      instrumentDays: sql<number>`count(*)::int`,
      instrumentsWithSignals: sql<number>`count(distinct ${strategyEvaluationResults.instrumentId}) filter (where ${strategyEvaluationResults.status} = 'signal')::int`,
      skippedDays: sql<number>`count(*) filter (where ${strategyEvaluationResults.status} = 'skipped')::int`,
      noSignalDays: sql<number>`count(*) filter (where ${strategyEvaluationResults.status} = 'no_signal')::int`,
      entries: sql<number>`(
        select count(*)::int from signals s
        where s.evaluation_run_id = ${runId} and s.signal_type = 'entry'
      )`,
      exits: sql<number>`(
        select count(*)::int from signals s
        where s.evaluation_run_id = ${runId} and s.signal_type in ('stop','target','eod')
      )`,
    })
    .from(strategyEvaluationResults)
    .where(eq(strategyEvaluationResults.evaluationRunId, runId));

  return (
    row ?? {
      instrumentDays: 0,
      instrumentsWithSignals: 0,
      skippedDays: 0,
      noSignalDays: 0,
      entries: 0,
      exits: 0,
    }
  );
}

export async function updateEvaluationRun(
  id: string,
  values: {
    status?: string;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    error?: unknown;
  },
) {
  const [updated] = await db
    .update(strategyEvaluationRuns)
    .set(values)
    .where(eq(strategyEvaluationRuns.id, id))
    .returning();
  return updated ?? null;
}

export async function cancelEvaluationRun(id: string) {
  const [updated] = await db
    .update(strategyEvaluationRuns)
    .set({ status: 'cancelled', finishedAt: new Date() })
    .where(
      and(
        eq(strategyEvaluationRuns.id, id),
        inArray(strategyEvaluationRuns.status, [...EVALUATION_ACTIVE_STATUSES]),
      ),
    )
    .returning();
  return updated ?? null;
}

export async function getEvaluationUniverseInstrumentIds(runId: string) {
  return db
    .select({ instrumentId: strategyEvaluationResults.instrumentId })
    .from(strategyEvaluationResults)
    .where(eq(strategyEvaluationResults.evaluationRunId, runId))
    .groupBy(strategyEvaluationResults.instrumentId);
}

export interface EvaluationDayResultInput {
  instrumentId: string;
  tradingDate: string;
  status: 'signal' | 'no_signal' | 'skipped';
  reasonCode: string | null;
  diagnostics: Record<string, unknown>;
}

export interface EvaluationDaySignalInput {
  strategyVersionId: string;
  evaluationRunId: string;
  accountId: string;
  instrumentId: string;
  configurationVersionId: string;
  signalAt: Date;
  candleStart: Date;
  direction: string;
  signalType: string;
  referencePrice: string;
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  quantity: string | null;
  evidence: Record<string, unknown>;
  status: string;
}

/** Replaces one run-day atomically so a retry cannot duplicate a decision. */
export async function replaceEvaluationDay(input: {
  runId: string;
  tradingDate: string;
  results: EvaluationDayResultInput[];
  signals: EvaluationDaySignalInput[];
}) {
  return db.transaction(async (tx) => {
    await tx
      .delete(signals)
      .where(
        and(
          eq(signals.evaluationRunId, input.runId),
          sql`${signals.candleStart} >= ${`${input.tradingDate}T00:00:00+05:30`}::timestamptz`,
          sql`${signals.candleStart} < ${`${input.tradingDate}T00:00:00+05:30`}::timestamptz + interval '1 day'`,
        ),
      );
    await tx
      .delete(strategyEvaluationResults)
      .where(
        and(
          eq(strategyEvaluationResults.evaluationRunId, input.runId),
          eq(strategyEvaluationResults.tradingDate, input.tradingDate),
        ),
      );

    if (input.results.length > 0) {
      await tx.insert(strategyEvaluationResults).values(
        input.results.map((row) => ({
          id: uuidv7(),
          evaluationRunId: input.runId,
          tradingDate: row.tradingDate,
          instrumentId: row.instrumentId,
          status: row.status,
          reasonCode: row.reasonCode,
          diagnostics: row.diagnostics,
        })),
      );
    }
    if (input.signals.length > 0) {
      await tx.insert(signals).values(
        input.signals.map((row) => ({
          id: uuidv7(),
          evaluationRunId: row.evaluationRunId,
          strategyVersionId: row.strategyVersionId,
          accountId: row.accountId,
          instrumentId: row.instrumentId,
          configurationVersionId: row.configurationVersionId,
          signalAt: row.signalAt,
          candleStart: row.candleStart,
          direction: row.direction,
          signalType: row.signalType,
          referencePrice: row.referencePrice,
          entryPrice: row.entryPrice,
          stopPrice: row.stopPrice,
          targetPrice: row.targetPrice,
          quantity: row.quantity,
          evidence: row.evidence,
          status: row.status,
        })),
      );
    }
    return { results: input.results.length, signals: input.signals.length };
  });
}

export async function deleteEvaluationRunArtifacts(runId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(signals).where(eq(signals.evaluationRunId, runId));
    await tx
      .delete(strategyEvaluationResults)
      .where(eq(strategyEvaluationResults.evaluationRunId, runId));
  });
}

export async function listEvaluationResults(filters: {
  runId: string;
  tradingDate?: string;
  status?: string;
  reasonCode?: string;
  instrumentId?: string;
  limit: number;
  offset: number;
}) {
  const conditions = [eq(strategyEvaluationResults.evaluationRunId, filters.runId)];
  if (filters.tradingDate) {
    conditions.push(eq(strategyEvaluationResults.tradingDate, filters.tradingDate));
  }
  if (filters.status) conditions.push(eq(strategyEvaluationResults.status, filters.status));
  if (filters.reasonCode) {
    conditions.push(eq(strategyEvaluationResults.reasonCode, filters.reasonCode));
  }
  if (filters.instrumentId) {
    conditions.push(eq(strategyEvaluationResults.instrumentId, filters.instrumentId));
  }

  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: strategyEvaluationResults.id,
        tradingDate: strategyEvaluationResults.tradingDate,
        instrumentId: strategyEvaluationResults.instrumentId,
        symbol: instruments.tradingSymbol,
        name: instruments.name,
        status: strategyEvaluationResults.status,
        reasonCode: strategyEvaluationResults.reasonCode,
        diagnostics: strategyEvaluationResults.diagnostics,
        signalCount: sql<number>`(
          select count(*)::int from signals s
          where s.evaluation_run_id = ${filters.runId}
            and s.instrument_id = ${strategyEvaluationResults.instrumentId}
            and s.candle_start >= ${strategyEvaluationResults.tradingDate}::date::timestamptz
            and s.candle_start < ${strategyEvaluationResults.tradingDate}::date::timestamptz + interval '1 day'
        )`,
      })
      .from(strategyEvaluationResults)
      .innerJoin(instruments, eq(instruments.id, strategyEvaluationResults.instrumentId))
      .where(and(...conditions))
      .orderBy(asc(strategyEvaluationResults.tradingDate), asc(instruments.tradingSymbol))
      .limit(filters.limit)
      .offset(filters.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(strategyEvaluationResults)
      .where(and(...conditions)),
  ]);

  return { items, total: totalRows[0]?.total ?? 0 };
}

export interface SignalFilters {
  runId?: string;
  strategyId?: string;
  strategyVersionId?: string;
  fromDate?: string;
  toDate?: string;
  instrumentId?: string;
  signalType?: string;
  limit: number;
  offset: number;
}

function signalConditions(filters: SignalFilters) {
  const conditions = [];
  if (filters.runId) conditions.push(eq(signals.evaluationRunId, filters.runId));
  if (filters.strategyId) conditions.push(eq(strategyVersions.strategyId, filters.strategyId));
  if (filters.strategyVersionId) {
    conditions.push(eq(signals.strategyVersionId, filters.strategyVersionId));
  }
  if (filters.fromDate) {
    conditions.push(sql`${signals.signalAt} >= ${filters.fromDate}::date::timestamptz`);
  }
  if (filters.toDate) {
    conditions.push(
      sql`${signals.signalAt} < ${filters.toDate}::date::timestamptz + interval '1 day'`,
    );
  }
  if (filters.instrumentId) conditions.push(eq(signals.instrumentId, filters.instrumentId));
  if (filters.signalType) conditions.push(eq(signals.signalType, filters.signalType));
  return conditions;
}

export async function listSignals(filters: SignalFilters) {
  const conditions = signalConditions(filters);
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: signals.id,
        evaluationRunId: signals.evaluationRunId,
        strategyVersionId: signals.strategyVersionId,
        instrumentId: signals.instrumentId,
        symbol: instruments.tradingSymbol,
        name: instruments.name,
        signalAt: signals.signalAt,
        candleStart: signals.candleStart,
        direction: signals.direction,
        signalType: signals.signalType,
        referencePrice: signals.referencePrice,
        entryPrice: signals.entryPrice,
        stopPrice: signals.stopPrice,
        targetPrice: signals.targetPrice,
        quantity: signals.quantity,
        evidence: signals.evidence,
        status: signals.status,
      })
      .from(signals)
      .innerJoin(instruments, eq(instruments.id, signals.instrumentId))
      .innerJoin(strategyVersions, eq(strategyVersions.id, signals.strategyVersionId))
      .where(and(...conditions))
      .orderBy(desc(signals.signalAt), desc(signals.id))
      .limit(filters.limit)
      .offset(filters.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(signals)
      .innerJoin(strategyVersions, eq(strategyVersions.id, signals.strategyVersionId))
      .where(and(...conditions)),
  ]);
  return { items, total: totalRows[0]?.total ?? 0 };
}

export async function getSignalForStrategy(strategyId: string, signalId: string) {
  const rows = await db
    .select({
      id: signals.id,
      evaluationRunId: signals.evaluationRunId,
      strategyVersionId: signals.strategyVersionId,
      version: strategyVersions.version,
      instrumentId: signals.instrumentId,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      signalAt: signals.signalAt,
      candleStart: signals.candleStart,
      direction: signals.direction,
      signalType: signals.signalType,
      referencePrice: signals.referencePrice,
      entryPrice: signals.entryPrice,
      stopPrice: signals.stopPrice,
      targetPrice: signals.targetPrice,
      quantity: signals.quantity,
      evidence: signals.evidence,
      status: signals.status,
      createdAt: signals.createdAt,
    })
    .from(signals)
    .innerJoin(instruments, eq(instruments.id, signals.instrumentId))
    .innerJoin(strategyVersions, eq(strategyVersions.id, signals.strategyVersionId))
    .where(and(eq(signals.id, signalId), eq(strategyVersions.strategyId, strategyId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTradingDaysInRange(from: string, to: string) {
  const rows = await db
    .select({
      tradingDate: tradingCalendar.tradingDate,
      isTradingDay: tradingCalendar.isTradingDay,
      sessionOpen: tradingCalendar.sessionOpen,
      sessionClose: tradingCalendar.sessionClose,
      description: tradingCalendar.description,
    })
    .from(tradingCalendar)
    .innerJoin(exchanges, eq(exchanges.id, tradingCalendar.exchangeId))
    .where(
      and(
        eq(exchanges.code, 'NSE'),
        eq(tradingCalendar.isTradingDay, true),
        gte(tradingCalendar.tradingDate, from),
        lte(tradingCalendar.tradingDate, to),
      ),
    )
    .orderBy(asc(tradingCalendar.tradingDate));
  return rows;
}

export async function getPriorTradingDaysBefore(date: string, limit: number) {
  return db
    .select({
      tradingDate: tradingCalendar.tradingDate,
      sessionOpen: tradingCalendar.sessionOpen,
      sessionClose: tradingCalendar.sessionClose,
    })
    .from(tradingCalendar)
    .innerJoin(exchanges, eq(exchanges.id, tradingCalendar.exchangeId))
    .where(
      and(
        eq(exchanges.code, 'NSE'),
        eq(tradingCalendar.isTradingDay, true),
        sql`${tradingCalendar.tradingDate} < ${date}::date`,
      ),
    )
    .orderBy(desc(tradingCalendar.tradingDate))
    .limit(limit);
}

export async function getCoverageInRange(
  instrumentIds: string[],
  from: string,
  to: string,
) {
  if (instrumentIds.length === 0) return [];
  return db
    .select({
      instrumentId: instrumentDayCoverage.instrumentId,
      tradingDate: instrumentDayCoverage.tradingDate,
      expectedBars: instrumentDayCoverage.expectedBars,
      storedBars: instrumentDayCoverage.storedBars,
    })
    .from(instrumentDayCoverage)
    .where(
      and(
        inArray(instrumentDayCoverage.instrumentId, instrumentIds),
        gte(instrumentDayCoverage.tradingDate, from),
        lte(instrumentDayCoverage.tradingDate, to),
      ),
    );
}

export async function getCorporateActionsInRange(
  instrumentIds: string[],
  from: string,
  to: string,
) {
  if (instrumentIds.length === 0) return [];
  return db
    .select({
      instrumentId: corporateActions.instrumentId,
      actionType: corporateActions.actionType,
      exDate: corporateActions.exDate,
    })
    .from(corporateActions)
    .where(
      and(
        inArray(corporateActions.instrumentId, instrumentIds),
        gte(corporateActions.exDate, from),
        lte(corporateActions.exDate, to),
      ),
    );
}

export async function getFinalCandlesForDay(instrumentIds: string[], date: string) {
  if (instrumentIds.length === 0) return [];
  return db
    .select({
      instrumentId: marketCandles1m.instrumentId,
      candleStart: marketCandles1m.candleStart,
      open: marketCandles1m.open,
      high: marketCandles1m.high,
      low: marketCandles1m.low,
      close: marketCandles1m.close,
      volume: marketCandles1m.volume,
    })
    .from(marketCandles1m)
    .where(
      and(
        inArray(marketCandles1m.instrumentId, instrumentIds),
        eq(marketCandles1m.tradingDate, date),
        eq(marketCandles1m.isFinal, true),
      ),
    )
    .orderBy(asc(marketCandles1m.instrumentId), asc(marketCandles1m.candleStart));
}

export async function getIndexCandlesForDates(indexId: string, dates: string[]) {
  if (dates.length === 0) return [];
  return db
    .select({
      candleStart: marketCandles1m.candleStart,
      open: marketCandles1m.open,
      high: marketCandles1m.high,
      low: marketCandles1m.low,
      close: marketCandles1m.close,
      volume: marketCandles1m.volume,
    })
    .from(marketCandles1m)
    .where(
      and(
        eq(marketCandles1m.instrumentId, indexId),
        inArray(marketCandles1m.tradingDate, dates),
        eq(marketCandles1m.isFinal, true),
      ),
    )
    .orderBy(asc(marketCandles1m.candleStart));
}

/**
 * Aggregated five-minute slot volume for the requested instrument-days. One query per run-day,
 * never one per instrument.
 */
export async function getFiveMinuteSlotVolume(
  instrumentIds: string[],
  dates: string[],
) {
  if (instrumentIds.length === 0 || dates.length === 0) return [];
  const ist = sql`(${marketCandles1m.candleStart} at time zone 'Asia/Kolkata')`;
  const slotStart = sql`date_trunc('hour', ${ist}) + floor(extract(minute from ${ist}) / 5) * interval '5 minutes'`;
  const rows = await db
    .select({
      instrumentId: marketCandles1m.instrumentId,
      tradingDate: marketCandles1m.tradingDate,
      slot: sql<string>`to_char(${slotStart}, 'HH24:MI')`,
      volume: sql<string>`sum(${marketCandles1m.volume})::text`,
    })
    .from(marketCandles1m)
    .where(
      and(
        inArray(marketCandles1m.instrumentId, instrumentIds),
        inArray(marketCandles1m.tradingDate, dates),
        eq(marketCandles1m.isFinal, true),
      ),
    )
    .groupBy(marketCandles1m.instrumentId, marketCandles1m.tradingDate, slotStart)
    .orderBy(
      asc(marketCandles1m.instrumentId),
      asc(marketCandles1m.tradingDate),
      asc(slotStart),
    );
  return rows.map((row) => ({
    instrumentId: row.instrumentId,
    tradingDate: row.tradingDate,
    slot: row.slot,
    volume: Number(row.volume),
  }));
}

export async function getStrategyByCode(code: string) {
  const rows = await db.select().from(strategies).where(eq(strategies.code, code)).limit(1);
  return rows[0] ?? null;
}

export async function getStrategyVersionWithBinding(versionId: string) {
  const rows = await db
    .select({
      id: strategyVersions.id,
      strategyId: strategyVersions.strategyId,
      strategyCode: strategies.code,
      version: strategyVersions.version,
      codeRef: strategyVersions.codeRef,
      parameterSchema: strategyVersions.parameterSchema,
      status: strategyVersions.status,
      parameterConfigurationVersionId: strategyConfigBindings.configurationVersionId,
    })
    .from(strategyVersions)
    .innerJoin(strategies, eq(strategies.id, strategyVersions.strategyId))
    .leftJoin(
      strategyConfigBindings,
      and(
        eq(strategyConfigBindings.strategyVersionId, strategyVersions.id),
        eq(strategyConfigBindings.role, 'parameters'),
      ),
    )
    .where(eq(strategyVersions.id, versionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSyncTargetEquities() {
  return db
    .select({
      id: instruments.id,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      segment: instruments.segment,
      instrumentType: instruments.instrumentType,
      tickSize: instruments.tickSize,
    })
    .from(instruments)
    .where(
      and(
        eq(instruments.isSyncTarget, true),
        eq(instruments.isActive, true),
        eq(instruments.instrumentType, 'EQ'),
        eq(instruments.segment, 'NSE_EQ'),
      ),
    )
    .orderBy(asc(instruments.tradingSymbol));
}

export async function getTradingCalendarBounds() {
  const [row] = await db
    .select({
      fromDate: sql<string | null>`min(${tradingCalendar.tradingDate})::text`,
      toDate: sql<string | null>`max(${tradingCalendar.tradingDate})::text`,
    })
    .from(tradingCalendar)
    .innerJoin(exchanges, eq(exchanges.id, tradingCalendar.exchangeId))
    .where(eq(exchanges.code, 'NSE'));
  return row ?? { fromDate: null, toDate: null };
}

/** Cancels the research run linked to a job when the operator uses the generic job cancel route. */
export async function cancelEvaluationRunByJobRunId(jobRunId: string) {
  const [row] = await db
    .update(strategyEvaluationRuns)
    .set({ status: 'cancelled', finishedAt: new Date() })
    .where(
      and(
        eq(strategyEvaluationRuns.jobRunId, jobRunId),
        inArray(strategyEvaluationRuns.status, [...EVALUATION_ACTIVE_STATUSES]),
      ),
    )
    .returning();
  return row ?? null;
}
