import { Injectable, Logger } from '@nestjs/common';
import type { Bar } from '@ai-trading/domain';
import {
  resolveOrbParameters,
  type OrbParameters,
  type RiskParameters,
  type StrategyEvaluation,
  type StrategyInstrument,
  type StrategyResultDiagnostics,
  type VolumeSlotSample,
} from '@ai-trading/domain';
import { riskConfigurationSchema, validateJsonSchema } from '@ai-trading/configuration';
import {
  evaluateOrbSession,
  resolveStrategyRuntime,
  validateStrategyParameters,
} from '@ai-trading/strategies';
import {
  addDays,
  isNormalSession,
  istInstant,
  istTime,
} from '@ai-trading/trading-engine';
import { missingMinutes } from '@ai-trading/market-data';
import {
  deleteEvaluationRunArtifacts,
  getCorporateActionsInRange,
  getCoverageInRange,
  getEvaluationRun,
  getEvaluationRunRiskConfiguration,
  getFinalCandlesForDay,
  getFiveMinuteSlotVolume,
  getIndexCandlesForDates,
  getInstrumentsByIds,
  getJobRun,
  getPriorTradingDaysBefore,
  getTradingDaysInRange,
  replaceEvaluationDay,
  updateEvaluationRun,
  updateJobRun,
  type EvaluationDayResultInput,
  type EvaluationDaySignalInput,
} from '@ai-trading/database';
import { JobTrackingService } from '../../observability/job-tracking.service.js';

const EMA_LOOKBACK_SESSIONS = 6;
interface RunContext {
  run: NonNullable<Awaited<ReturnType<typeof getEvaluationRun>>>;
  parameters: OrbParameters;
  risk: RiskParameters;
  instruments: StrategyInstrument[];
  indexInstrument: StrategyInstrument;
}

interface PreflightSkip {
  instrumentId: string;
  reason: string;
  coverage: {
    expectedBars: number | null;
    storedBars: number | null;
    indexExpectedBars: number | null;
    indexStoredBars: number | null;
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function asJsonSchema(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toBar(row: {
  candleStart: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}): Bar {
  return {
    instrument: '',
    timeframe: '1m',
    timestamp: row.candleStart,
    open: toNumber(row.open),
    high: toNumber(row.high),
    low: toNumber(row.low),
    close: toNumber(row.close),
    volume: toNumber(row.volume),
  };
}

function diagnostics(input: {
  reason: string;
  tradingDate: string;
  sessionOpen: string | null;
  sessionClose: string | null;
  coverage: PreflightSkip['coverage'];
  note?: string;
}): Record<string, unknown> {
  return {
    diagnosticsVersion: 1,
    reason: input.reason,
    coverage: input.coverage,
    session: {
      tradingDate: input.tradingDate,
      open: input.sessionOpen,
      close: input.sessionClose,
    },
    openingRange: null,
    candidates: [],
    portfolio: { entries: 0, openPositions: 0 },
    ...(input.note ? { note: input.note } : {}),
  };
}

@Injectable()
export class StrategyEvaluationService {
  private readonly logger = new Logger(StrategyEvaluationService.name);

  constructor(private readonly tracking: JobTrackingService) {}

  async run(jobName: string, payload: Record<string, unknown>) {
    if (jobName !== 'strategy-evaluation') {
      throw new Error(`Unknown strategy-evaluation job: ${jobName}`);
    }
    return this.runEvaluation(String(payload.jobRunId), String(payload.evaluationRunId));
  }

  private async runEvaluation(jobRunId: string, evaluationRunId: string) {
    let currentDay: string | null = null;
    let context: RunContext | null = null;

    try {
      this.tracking.enterStage(jobRunId, 'prepare');
      context = await this.prepare(jobRunId, evaluationRunId);
      this.tracking.completeStage(jobRunId, 'prepare', 'completed', {
        fromDate: context.run.fromDate,
        toDate: context.run.toDate,
        instruments: context.instruments.length,
      });

      this.tracking.enterStage(jobRunId, 'evaluate');
      const days = await getTradingDaysInRange(context.run.fromDate, context.run.toDate);
      const priorDays = await getPriorTradingDaysBefore(context.run.fromDate, 60);
      const history = [...priorDays].reverse().concat(days);
      let completedDays = 0;
      let evaluated = 0;
      let entries = 0;
      let exits = 0;
      const skippedByReason: Record<string, number> = {};

      for (const [index, day] of days.entries()) {
        currentDay = day.tradingDate;
        if (await this.isCancelled(jobRunId)) {
          await this.finish(jobRunId, evaluationRunId, 'cancelled', {
            daysCompleted: completedDays,
            evaluated,
            entries,
            exits,
            skippedByReason,
            cancelledAt: currentDay,
          });
          return { cancelled: true, days: completedDays, evaluated, entries, exits };
        }

        const dayHistoryIndex = history.findIndex(
          (item) => item.tradingDate === day.tradingDate,
        );
        const previousDays = history.slice(0, dayHistoryIndex).slice(-60);
        const daySummary = await this.evaluateDay(context, day, previousDays);
        completedDays += 1;
        evaluated += daySummary.evaluated;
        entries += daySummary.entries;
        exits += daySummary.exits;
        for (const [reason, count] of Object.entries(daySummary.skippedByReason)) {
          skippedByReason[reason] = (skippedByReason[reason] ?? 0) + count;
        }

        this.tracking.progress(jobRunId, 'evaluate', {
          index: index + 1,
          total: days.length,
          tradingDate: day.tradingDate,
          evaluated: daySummary.evaluated,
          entries: daySummary.entries,
          exits: daySummary.exits,
        });
      }

      const skipped = Object.values(skippedByReason).reduce(
        (total, count) => total + count,
        0,
      );
      const coverage = {
        instrumentDays: evaluated,
        skipped,
        evaluablePct:
          evaluated === 0
            ? 0
            : Number((((evaluated - skipped) / evaluated) * 100).toFixed(2)),
        skippedByReason,
      };
      this.tracking.completeStage(jobRunId, 'evaluate', 'completed', {
        days: completedDays,
        entries,
        exits,
        coverage,
      });
      this.tracking.enterStage(jobRunId, 'finalize');
      await this.finish(jobRunId, evaluationRunId, 'completed', {
        days: completedDays,
        entries,
        exits,
        coverage,
      });
      this.tracking.completeStage(jobRunId, 'finalize', 'completed', {
        days: completedDays,
        entries,
        exits,
        coverage,
      });
      return { days: completedDays, evaluated, entries, exits, coverage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Evaluation ${evaluationRunId} failed: ${message}`);
      await updateEvaluationRun(evaluationRunId, {
        status: 'failed',
        finishedAt: new Date(),
        error: {
          code: 'evaluation_failed',
          message,
          ...(currentDay ? { day: currentDay } : {}),
        },
      }).catch(() => undefined);
      try {
        this.tracking.completeStage(jobRunId, 'evaluate', 'failed', { error: message });
      } catch {
        // The tracker is best-effort; the run row already records the failure.
      }
      throw error;
    }
  }

  private async prepare(jobRunId: string, evaluationRunId: string): Promise<RunContext> {
    const run = await getEvaluationRun(evaluationRunId);
    if (!run) throw new Error(`Evaluation run ${evaluationRunId} not found`);

    const runtime = resolveStrategyRuntime({
      code: run.strategyCode,
      codeRef: run.codeRef,
      parameterSchema: asJsonSchema(run.parameterSchema),
    });
    if (runtime.status !== 'registered') {
      throw new Error(runtime.error ?? `Strategy version is not runnable (${runtime.status})`);
    }

    const parameterErrors = validateStrategyParameters(
      asJsonSchema(run.parameterSchema),
      run.parameterPayload,
    );
    if (parameterErrors.length > 0) {
      throw new Error(`Invalid strategy parameters: ${parameterErrors.join('; ')}`);
    }

    const riskConfig = await getEvaluationRunRiskConfiguration(evaluationRunId);
    if (!riskConfig) throw new Error('Risk configuration is missing');
    const riskErrors = validateJsonSchema(riskConfigurationSchema, riskConfig.payload);
    if (riskErrors.length > 0) {
      throw new Error(`Invalid risk configuration: ${riskErrors.join('; ')}`);
    }
    const riskPayload = riskConfig.payload as {
      riskPerTradePct: number;
      maxOpenPositions: number;
      maxEntriesPerDay: number;
    };

    const universe = run.universe as {
      market: { id: string; symbol: string; exchange: string };
      resolved: { id: string; symbol: string }[];
    };
    const instrumentRows = await getInstrumentsByIds(universe.resolved.map((item) => item.id));
    const rowById = new Map(instrumentRows.map((row) => [row.instrumentId, row]));
    const instruments = universe.resolved
      .map((item) => {
        const row = rowById.get(item.id);
        if (!row) throw new Error(`Universe instrument ${item.id} no longer exists`);
        return {
          id: row.instrumentId,
          symbol: row.symbol,
          tickSize: toNumber(row.tickSize),
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    const indexRows = await getInstrumentsByIds([universe.market.id]);
    const index = indexRows[0];
    if (!index) throw new Error('The pinned NIFTY 50 index instrument no longer exists');

    if (instruments.length === 0) {
      throw new Error('The evaluation universe contains no tradable instrument');
    }

    await deleteEvaluationRunArtifacts(evaluationRunId);
    await updateEvaluationRun(evaluationRunId, {
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
      error: null,
    });
    this.tracking.warning(jobRunId, 'prepare', {
      note: `Evaluation uses ${instruments.length} instruments and ${universe.market.symbol} as market confirmation`,
    });

    return {
      run,
      parameters: resolveOrbParameters(run.parameterPayload as OrbParameters),
      risk: {
        riskPerTradePct: Number(riskPayload.riskPerTradePct),
        maxOpenPositions: Number(riskPayload.maxOpenPositions),
        maxEntriesPerDay: Number(riskPayload.maxEntriesPerDay),
      },
      instruments,
      indexInstrument: {
        id: index.instrumentId,
        symbol: index.symbol,
        tickSize: toNumber(index.tickSize),
      },
    };
  }

  private async evaluateDay(
    context: RunContext,
    day: {
      tradingDate: string;
      isTradingDay: boolean;
      sessionOpen: Date | null;
      sessionClose: Date | null;
    },
    priorDays: { tradingDate: string }[],
  ) {
    const tradingDate = day.tradingDate;
    const sessionOpenText = day.sessionOpen ? istTime(day.sessionOpen) : null;
    const sessionCloseText = day.sessionClose ? istTime(day.sessionClose) : null;
    const instrumentIds = context.instruments.map((instrument) => instrument.id);
    const allIds = [...instrumentIds, context.indexInstrument.id];

    if (!day.sessionOpen || !day.sessionClose) {
      return this.persistSkippedDay(
        context,
        tradingDate,
        instrumentIds,
        'session_missing',
        {
          expectedBars: null,
          storedBars: null,
          indexExpectedBars: null,
          indexStoredBars: null,
        },
        sessionOpenText,
        sessionCloseText,
      );
    }

    if (!day.isTradingDay || !isNormalSession(day.sessionOpen, day.sessionClose)) {
      return this.persistSkippedDay(
        context,
        tradingDate,
        instrumentIds,
        'special_session',
        {
          expectedBars: null,
          storedBars: null,
          indexExpectedBars: null,
          indexStoredBars: null,
        },
        sessionOpenText,
        sessionCloseText,
      );
    }

    const coverage = await getCoverageInRange(allIds, tradingDate, tradingDate);
    const coverageByInstrument = new Map(coverage.map((row) => [row.instrumentId, row]));
    const indexCoverage = coverageByInstrument.get(context.indexInstrument.id);
    const indexExpected = indexCoverage?.expectedBars ?? null;
    const indexStored = indexCoverage?.storedBars ?? null;

    if (!indexCoverage || indexStored === null || indexExpected === null || indexStored === 0) {
      return this.persistSkippedDay(
        context,
        tradingDate,
        instrumentIds,
        'index_insufficient_coverage',
        {
          expectedBars: null,
          storedBars: null,
          indexExpectedBars: indexExpected,
          indexStoredBars: indexStored,
        },
        sessionOpenText,
        sessionCloseText,
      );
    }

    const skips: PreflightSkip[] = [];
    for (const instrument of context.instruments) {
      if (!coverageByInstrument.has(instrument.id)) {
        skips.push({
          instrumentId: instrument.id,
          reason: 'coverage_missing',
          coverage: {
            expectedBars: null,
            storedBars: null,
            indexExpectedBars: indexExpected,
            indexStoredBars: indexStored,
          },
        });
      }
    }

    // Load bars before the coverage verdict: a short day only skips an instrument
    // when the missing minute intersects a bar the strategy reads.
    const covered = context.instruments.filter((instrument) =>
      coverageByInstrument.has(instrument.id),
    );
    const candles = await getFinalCandlesForDay(
      [...covered.map((instrument) => instrument.id), context.indexInstrument.id],
      tradingDate,
    );
    const barsByInstrument = new Map<string, Bar[]>();
    const indexBars: Bar[] = [];
    for (const row of candles) {
      const bar = toBar(row);
      if (row.instrumentId === context.indexInstrument.id) {
        indexBars.push({ ...bar, instrument: context.indexInstrument.symbol });
        continue;
      }
      const list = barsByInstrument.get(row.instrumentId) ?? [];
      list.push(bar);
      barsByInstrument.set(row.instrumentId, list);
    }

    const session = {
      open: day.sessionOpen,
      close: day.sessionClose,
      breaks: [] as { start: Date; end: Date }[],
    };
    const entryEnd = istInstant(tradingDate, context.parameters.entryWindowEnd);
    const indexRequiredMissing = missingMinutes(
      session,
      indexBars.map((bar) => bar.timestamp),
    ).filter((minute) => minute.getTime() < entryEnd.getTime());

    if (indexRequiredMissing.length > 0) {
      return this.persistSkippedDay(
        context,
        tradingDate,
        instrumentIds,
        'index_insufficient_coverage',
        {
          expectedBars: null,
          storedBars: null,
          indexExpectedBars: indexExpected,
          indexStoredBars: indexStored,
        },
        sessionOpenText,
        sessionCloseText,
        `Index decision window is missing ${indexRequiredMissing.length} minute(s).`,
      );
    }

    const eligible: StrategyInstrument[] = [];
    const unverifiableExit: string[] = [];
    const toleratedGapMinutes = new Map<string, number>();
    for (const instrument of covered) {
      const row = coverageByInstrument.get(instrument.id)!;
      const missing = missingMinutes(
        session,
        (barsByInstrument.get(instrument.id) ?? []).map((bar) => bar.timestamp),
      );
      const requiredMissing = missing.filter(
        (minute) => minute.getTime() < entryEnd.getTime(),
      );
      if (requiredMissing.length > 0) {
        skips.push({
          instrumentId: instrument.id,
          reason: 'coverage_partial',
          coverage: {
            expectedBars: row.expectedBars,
            storedBars: row.storedBars,
            indexExpectedBars: indexExpected,
            indexStoredBars: indexStored,
          },
        });
        continue;
      }
      if (missing.length > 0) {
        // The decision window is intact but the exit window is not. The evaluator
        // withholds any entry so a stop/target path is never assumed.
        unverifiableExit.push(instrument.id);
        toleratedGapMinutes.set(instrument.id, missing.length);
      }
      eligible.push(instrument);
    }

    const warmupStart = addDays(tradingDate, -45);
    const actions = await getCorporateActionsInRange(instrumentIds, warmupStart, tradingDate);
    const actionInstruments = new Set(
      actions
        .filter((action) => action.exDate >= warmupStart && action.exDate <= tradingDate)
        .map((action) => action.instrumentId),
    );
    for (const instrument of eligible.slice()) {
      if (actionInstruments.has(instrument.id)) {
        eligible.splice(eligible.indexOf(instrument), 1);
        const row = coverageByInstrument.get(instrument.id)!;
        skips.push({
          instrumentId: instrument.id,
          reason: 'corporate_action',
          coverage: {
            expectedBars: row.expectedBars,
            storedBars: row.storedBars,
            indexExpectedBars: indexExpected,
            indexStoredBars: indexStored,
          },
        });
      }
    }

    const priorDates = priorDays.map((item) => item.tradingDate).slice(-60);
    const indexDates = [
      ...priorDates.slice(-(EMA_LOOKBACK_SESSIONS - 1)),
      tradingDate,
    ];
    const indexHistory = await getIndexCandlesForDates(context.indexInstrument.id, indexDates);

    const volumeHistory = await this.loadVolumeHistory(context, priorDates);

    const eligibleSet = new Set(eligible.map((instrument) => instrument.id));
    const instrumentBars = new Map<string, readonly Bar[]>();
    for (const [instrumentId, bars] of barsByInstrument) {
      if (eligibleSet.has(instrumentId)) instrumentBars.set(instrumentId, bars);
    }

    const evaluation = evaluateOrbSession({
      runAt: new Date(),
      session: {
        tradingDate,
        open: day.sessionOpen,
        close: day.sessionClose,
      },
      instruments: eligible,
      bars: instrumentBars,
      indexBars: [...indexHistory.map((row) => ({ ...toBar(row), instrument: context.indexInstrument.symbol })), ...indexBars],
      indexInstrument: context.indexInstrument,
      volumeHistory,
      initialCapital: Number(context.run.initialCapital),
      parameters: context.parameters,
      risk: context.risk,
      codeRef: context.run.codeRef,
      parameterHash: context.run.parameterHash,
      unverifiableExitInstruments: unverifiableExit,
      coverage: {
        expectedBars: null,
        storedBars: null,
        indexExpectedBars: indexExpected,
        indexStoredBars: indexStored,
      },
    });

    return this.persistDay(context, tradingDate, eligible, skips, evaluation, {
      sessionOpenText,
      sessionCloseText,
      expectedBars: null,
      storedBars: null,
      indexExpectedBars: indexExpected,
      indexStoredBars: indexStored,
      coverageByInstrument,
      toleratedGapMinutes,
    });
  }

  private async loadVolumeHistory(context: RunContext, priorDates: string[]) {
    const instrumentIds = context.instruments.map((instrument) => instrument.id);
    const lookback = Math.max(
      1,
      Math.min(60, context.parameters.volumeLookbackSessions ?? 20),
    );
    const coverage = await getCoverageInRange(
      instrumentIds,
      priorDates[0] ?? context.run.fromDate,
      priorDates.at(-1) ?? context.run.fromDate,
    );
    const completeByInstrument = new Map<string, string[]>();
    for (const row of coverage) {
      if (row.storedBars !== row.expectedBars) continue;
      const list = completeByInstrument.get(row.instrumentId) ?? [];
      list.push(row.tradingDate);
      completeByInstrument.set(row.instrumentId, list);
    }

    const selectedDates = new Set<string>();
    const datesByInstrument = new Map<string, Set<string>>();
    for (const instrument of context.instruments) {
      const dates = (completeByInstrument.get(instrument.id) ?? [])
        .sort()
        .slice(-lookback);
      datesByInstrument.set(instrument.id, new Set(dates));
      for (const date of dates) selectedDates.add(date);
    }

    const rows = await getFiveMinuteSlotVolume(instrumentIds, [...selectedDates]);
    const history = new Map<string, VolumeSlotSample[]>();
    for (const row of rows) {
      const allowed = datesByInstrument.get(row.instrumentId);
      if (!allowed?.has(row.tradingDate)) continue;
      const list = history.get(row.instrumentId) ?? [];
      list.push({ tradingDate: row.tradingDate, slot: row.slot, volume: row.volume });
      history.set(row.instrumentId, list);
    }
    return history;
  }

  private async persistDay(
    context: RunContext,
    tradingDate: string,
    eligible: StrategyInstrument[],
    skips: PreflightSkip[],
    evaluation: StrategyEvaluation,
    input: {
      sessionOpenText: string | null;
      sessionCloseText: string | null;
      expectedBars: number | null;
      storedBars: number | null;
      indexExpectedBars: number | null;
      indexStoredBars: number | null;
      coverageByInstrument: Map<string, { expectedBars: number; storedBars: number }>;
      toleratedGapMinutes: Map<string, number>;
    },
  ) {
    const results: EvaluationDayResultInput[] = [];
    const resultByInstrument = new Map(evaluation.results.map((result) => [result.instrumentId, result]));

    for (const instrument of context.instruments) {
      const row = input.coverageByInstrument.get(instrument.id);
      const skip = skips.find((item) => item.instrumentId === instrument.id);
      const evaluated = resultByInstrument.get(instrument.id);
      if (skip) {
        results.push({
          instrumentId: instrument.id,
          tradingDate,
          status: 'skipped',
          reasonCode: skip.reason,
          diagnostics: diagnostics({
            reason: skip.reason,
            tradingDate,
            sessionOpen: input.sessionOpenText,
            sessionClose: input.sessionCloseText,
            coverage: skip.coverage,
          }),
        });
        continue;
      }
      if (!evaluated) {
        results.push({
          instrumentId: instrument.id,
          tradingDate,
          status: 'skipped',
          reasonCode: 'coverage_missing',
          diagnostics: diagnostics({
            reason: 'coverage_missing',
            tradingDate,
            sessionOpen: input.sessionOpenText,
            sessionClose: input.sessionCloseText,
            coverage: {
              expectedBars: row?.expectedBars ?? null,
              storedBars: row?.storedBars ?? null,
              indexExpectedBars: input.indexExpectedBars,
              indexStoredBars: input.indexStoredBars,
            },
          }),
        });
        continue;
      }
      results.push({
        instrumentId: instrument.id,
        tradingDate,
        status: evaluated.status,
        reasonCode: evaluated.reasonCode,
        diagnostics: {
          ...evaluated.diagnostics,
          ...(input.toleratedGapMinutes.has(instrument.id)
            ? { toleratedGapMinutes: input.toleratedGapMinutes.get(instrument.id) }
            : {}),
          coverage: {
            expectedBars: row?.expectedBars ?? null,
            storedBars: row?.storedBars ?? null,
            indexExpectedBars: input.indexExpectedBars,
            indexStoredBars: input.indexStoredBars,
          },
        } satisfies StrategyResultDiagnostics,
      });
    }

    const signals: EvaluationDaySignalInput[] = evaluation.signals
      .filter((signal) => eligible.some((instrument) => instrument.id === signal.instrumentId))
      .map((signal) => ({
        strategyVersionId: context.run.strategyVersionId,
        evaluationRunId: context.run.id,
        accountId: context.run.accountId,
        instrumentId: signal.instrumentId,
        configurationVersionId: context.run.configurationVersionId,
        signalAt: signal.signalAt,
        candleStart: signal.candleStart,
        direction: signal.side,
        signalType: signal.signalType,
        referencePrice: signal.referencePrice.toFixed(4),
        entryPrice: signal.entryPrice.toFixed(4),
        stopPrice: signal.stopPrice.toFixed(4),
        targetPrice: signal.targetPrice.toFixed(4),
        quantity: signal.quantity.toFixed(4),
        evidence: signal.evidence as unknown as Record<string, unknown>,
        status: 'created',
      }));

    await replaceEvaluationDay({
      runId: context.run.id,
      tradingDate,
      results,
      signals,
    });

    const entries = signals.filter((signal) => signal.signalType === 'entry').length;
    const skippedByReason: Record<string, number> = {};
    for (const row of results) {
      if (row.status !== 'skipped' || !row.reasonCode) continue;
      skippedByReason[row.reasonCode] = (skippedByReason[row.reasonCode] ?? 0) + 1;
    }
    return {
      evaluated: results.length,
      entries,
      exits: signals.length - entries,
      skippedByReason,
    };
  }

  private async persistSkippedDay(
    context: RunContext,
    tradingDate: string,
    instrumentIds: string[],
    reason: string,
    coverage: PreflightSkip['coverage'],
    sessionOpen: string | null,
    sessionClose: string | null,
    note?: string,
  ) {
    const results: EvaluationDayResultInput[] = instrumentIds.map((instrumentId) => ({
      instrumentId,
      tradingDate,
      status: 'skipped',
      reasonCode: reason,
      diagnostics: diagnostics({
        reason,
        tradingDate,
        sessionOpen,
        sessionClose,
        coverage,
        ...(note ? { note } : {}),
      }),
    }));
    await replaceEvaluationDay({ runId: context.run.id, tradingDate, results, signals: [] });
    return {
      evaluated: results.length,
      entries: 0,
      exits: 0,
      skippedByReason: { [reason]: results.length },
    };
  }

  private async isCancelled(jobRunId: string) {
    const job = await getJobRun(jobRunId);
    return job?.status === 'cancelled';
  }

  private async finish(
    jobRunId: string,
    evaluationRunId: string,
    status: 'completed' | 'cancelled',
    result: Record<string, unknown>,
  ) {
    await updateEvaluationRun(evaluationRunId, {
      status,
      finishedAt: new Date(),
      error: null,
    });
    await updateJobRun(jobRunId, { result });
  }
}
