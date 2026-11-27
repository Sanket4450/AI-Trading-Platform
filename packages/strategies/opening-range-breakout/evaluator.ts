import type {
  Bar,
  EvaluationReasonCode,
  OrbParameters,
  RiskParameters,
  StrategyBreakoutCandidate,
  StrategyEvaluation,
  StrategyInstrument,
  StrategyInstrumentResult,
  StrategyResultDiagnostics,
  StrategySignal,
  StrategySignalEvidence,
} from '@ai-trading/domain';
import { ORB_STRATEGY_CODE, resolveOrbParameters } from '@ai-trading/domain';
import {
  ceilToTick,
  cumulativeVwap,
  emaAt,
  fiveMinuteSlot,
  floorToTick,
  isNormalSession,
  istClock,
  istInstant,
  istTime,
  median,
  nearestTick,
  rollupFiveMinuteBars,
  type FiveMinuteBar,
  type StrategySessionContext,
  type StrategySessionWindow,
} from '@ai-trading/trading-engine';

const FIVE_MINUTES_MS = 5 * 60_000;
const ONE_MINUTE_MS = 60_000;
const ORB_MAX_OPEN_POSITIONS = 1;
const MAX_DIAGNOSTIC_CANDIDATES = 10;

interface Candidate {
  readonly bar: FiveMinuteBar;
  readonly vwap: number;
  readonly market: { close: number; emaFast: number; emaSlow: number };
  readonly volume: { slot: string; median: number; ratio: number };
}

interface InstrumentAnalysis {
  readonly instrument: StrategyInstrument;
  readonly bars: readonly Bar[];
  readonly fiveMinute: readonly FiveMinuteBar[];
  readonly byStart: ReadonlyMap<number, FiveMinuteBar>;
  readonly openingRange: { high: number; low: number } | null;
  readonly candidates: readonly Candidate[];
  readonly candidateByStart: ReadonlyMap<number, Candidate>;
  readonly skippedReason: EvaluationReasonCode | null;
  readonly noSignalReason: EvaluationReasonCode | null;
  readonly diagnosticsCandidates: StrategyResultDiagnostics['candidates'];
  readonly note?: string;
}

interface OpenPosition {
  readonly instrument: StrategyInstrument;
  readonly entrySignal: StrategySignal;
  readonly decisionBar: FiveMinuteBar;
  readonly nextExitAt: Date;
}

interface ExitResult {
  readonly signal: StrategySignal;
  readonly bar: Bar;
  readonly price: number;
}

function reasonDiagnostics(
  context: StrategySessionContext,
  reason: EvaluationReasonCode | null,
  input: {
    openingRange?: { high: number; low: number } | null;
    candidates?: StrategyResultDiagnostics['candidates'];
    portfolio?: { entries: number; openPositions: number };
    note?: string;
  } = {},
): StrategyResultDiagnostics {
  return {
    diagnosticsVersion: 1,
    reason,
    coverage: {
      expectedBars: context.coverage?.expectedBars ?? null,
      storedBars: context.coverage?.storedBars ?? null,
      indexExpectedBars: context.coverage?.indexExpectedBars ?? null,
      indexStoredBars: context.coverage?.indexStoredBars ?? null,
    },
    session: {
      tradingDate: context.session.tradingDate,
      open: context.session.open ? istTime(context.session.open) : null,
      close: context.session.close ? istTime(context.session.close) : null,
    },
    openingRange: input.openingRange ?? null,
    candidates: (input.candidates ?? []).slice(0, MAX_DIAGNOSTIC_CANDIDATES),
    portfolio: input.portfolio ?? { entries: 0, openPositions: 0 },
    ...(input.note ? { note: input.note } : {}),
  };
}

function result(
  instrument: StrategyInstrument,
  status: StrategyInstrumentResult['status'],
  reason: EvaluationReasonCode | null,
  diagnostics: StrategyResultDiagnostics,
): StrategyInstrumentResult {
  return {
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    status,
    reasonCode: reason,
    diagnostics,
  };
}

function validTick(tickSize: number): boolean {
  return Number.isFinite(tickSize) && tickSize > 0;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function isAfterOrEqual(a: Date, b: Date): boolean {
  return a.getTime() >= b.getTime();
}

function barsBetween(
  bars: readonly Bar[],
  from: Date,
  exclusiveTo: Date,
): readonly Bar[] {
  return bars.filter(
    (bar) => bar.timestamp.getTime() >= from.getTime() && bar.timestamp.getTime() < exclusiveTo.getTime(),
  );
}

function expectedSlots(start: Date, exclusiveEnd: Date): Date[] {
  const slots: Date[] = [];
  for (let cursor = start.getTime(); cursor < exclusiveEnd.getTime(); cursor += FIVE_MINUTES_MS) {
    slots.push(new Date(cursor));
  }
  return slots;
}

function analyzeInstrument(
  context: StrategySessionContext,
  instrument: StrategyInstrument,
  params: ReturnType<typeof resolveOrbParameters>,
  exclusions: {
    indexBars: readonly FiveMinuteBar[];
    indexByStart: ReadonlyMap<number, FiveMinuteBar>;
    openingSlots: readonly Date[];
    decisionSlots: readonly Date[];
    volumeHistory: readonly { tradingDate: string; slot: string; volume: number }[];
  },
): InstrumentAnalysis {
  const base = {
    instrument,
    bars: [] as readonly Bar[],
    fiveMinute: [] as readonly FiveMinuteBar[],
    byStart: new Map<number, FiveMinuteBar>(),
    openingRange: null,
    candidates: [] as readonly Candidate[],
    candidateByStart: new Map<number, Candidate>(),
    diagnosticsCandidates: [] as StrategyResultDiagnostics['candidates'],
    skippedReason: null as EvaluationReasonCode | null,
    noSignalReason: null as EvaluationReasonCode | null,
  };

  if (!validTick(instrument.tickSize)) {
    return { ...base, skippedReason: 'invalid_tick', noSignalReason: null };
  }

  const bars = (context.bars.get(instrument.id) ?? [])
    .filter(
      (bar) =>
        bar.timeframe === '1m' &&
        istClock(bar.timestamp).date === context.session.tradingDate &&
        isAfterOrEqual(bar.timestamp, context.session.open) &&
        bar.timestamp.getTime() < context.session.close.getTime(),
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const fiveMinute = rollupFiveMinuteBars(bars);
  const byStart = new Map(fiveMinute.map((bar) => [bar.timestamp.getTime(), bar]));

  const openingBars: FiveMinuteBar[] = [];
  for (const slot of exclusions.openingSlots) {
    const bar = byStart.get(slot.getTime());
    if (!bar || !bar.complete) {
      return {
        ...base,
        bars,
        fiveMinute,
        byStart,
        skippedReason: 'opening_range_incomplete',
      };
    }
    openingBars.push(bar);
  }

  if (openingBars.length === 0) {
    return { ...base, bars, fiveMinute, byStart, skippedReason: 'opening_range_incomplete' };
  }

  const openingRange = {
    high: Math.max(...openingBars.map((bar) => bar.high)),
    low: Math.min(...openingBars.map((bar) => bar.low)),
  };

  for (const slot of exclusions.decisionSlots) {
    const bar = byStart.get(slot.getTime());
    if (!bar || !bar.complete) {
      return {
        ...base,
        bars,
        fiveMinute,
        byStart,
        openingRange,
        skippedReason: 'decision_bar_incomplete',
      };
    }
  }

  const slotVolumes = new Map<string, number[]>();
  for (const sample of exclusions.volumeHistory) {
    const list = slotVolumes.get(sample.slot) ?? [];
    list.push(sample.volume);
    slotVolumes.set(sample.slot, list);
  }
  const historyDates = new Set(exclusions.volumeHistory.map((sample) => sample.tradingDate));
  if (historyDates.size < params.volumeLookbackSessions) {
    return {
      ...base,
      bars,
      fiveMinute,
      byStart,
      openingRange,
      skippedReason: 'warmup',
    };
  }

  const candidates: Candidate[] = [];
  const candidateByStart = new Map<number, Candidate>();
  const diagnosticCandidates: StrategyBreakoutCandidate[] = [];
  let breakoutCount = 0;
  let belowVwapCount = 0;
  let marketFailCount = 0;
  let volumeFailCount = 0;
  let dataReason: EvaluationReasonCode | null = null;

  const recordCandidate = (input: {
    bar: FiveMinuteBar;
    vwap: number | null;
    marketPass: boolean;
    volumeRatio: number | null;
    qualified: boolean;
  }) => {
    if (diagnosticCandidates.length >= 10) return;
    diagnosticCandidates.push({
      barStart: input.bar.timestamp.toISOString(),
      close: input.bar.close,
      breakout: true,
      vwap: input.vwap,
      marketPass: input.marketPass,
      volumeRatio: input.volumeRatio,
      qualified: input.qualified,
    });
  };

  for (const slot of exclusions.decisionSlots) {
    const bar = byStart.get(slot.getTime())!;
    if (bar.close <= openingRange.high) continue;
    breakoutCount += 1;

    const vwapResult = cumulativeVwap(
      bars,
      context.session.open,
      new Date(bar.timestamp.getTime() + FIVE_MINUTES_MS - ONE_MINUTE_MS),
    );
    if (vwapResult.volume <= 0 || vwapResult.vwap === null) {
      recordCandidate({
        bar,
        vwap: null,
        marketPass: false,
        volumeRatio: null,
        qualified: false,
      });
      dataReason = 'vwap_unavailable';
      break;
    }
    if (params.vwapConfirmation && bar.close <= vwapResult.vwap) {
      belowVwapCount += 1;
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: false,
        volumeRatio: null,
        qualified: false,
      });
      continue;
    }

    const indexBar = exclusions.indexByStart.get(bar.timestamp.getTime());
    if (!indexBar || !indexBar.complete) {
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: false,
        volumeRatio: null,
        qualified: false,
      });
      dataReason = 'index_data_gap';
      break;
    }

    const closes = exclusions.indexBars
      .filter((item) => item.timestamp.getTime() <= bar.timestamp.getTime())
      .slice(-params.emaLookbackBars)
      .map((item) => item.close);
    if (closes.length < params.emaLookbackBars) {
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: false,
        volumeRatio: null,
        qualified: false,
      });
      dataReason = 'warmup';
      break;
    }
    const emaFast = emaAt(closes, params.emaFastPeriod);
    const emaSlow = emaAt(closes, params.emaSlowPeriod);
    if (emaFast === null || emaSlow === null) {
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: false,
        volumeRatio: null,
        qualified: false,
      });
      dataReason = 'warmup';
      break;
    }
    const indexClose = closes[closes.length - 1]!;
    if (!(indexClose > emaFast && emaFast > emaSlow)) {
      marketFailCount += 1;
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: false,
        volumeRatio: null,
        qualified: false,
      });
      continue;
    }

    const slotKey = fiveMinuteSlot(bar.timestamp);
    const samples = (slotVolumes.get(slotKey) ?? []).slice(-params.volumeLookbackSessions);
    if (samples.length < params.volumeLookbackSessions) {
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: true,
        volumeRatio: null,
        qualified: false,
      });
      dataReason = 'volume_history_insufficient';
      break;
    }
    const medianVolume = median(samples);
    if (medianVolume <= 0) {
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: true,
        volumeRatio: null,
        qualified: false,
      });
      dataReason = 'volume_history_zero';
      break;
    }
    const ratio = bar.volume / medianVolume;
    if (ratio < params.volumeRatioMin) {
      volumeFailCount += 1;
      recordCandidate({
        bar,
        vwap: vwapResult.vwap,
        marketPass: true,
        volumeRatio: round6(ratio),
        qualified: false,
      });
      continue;
    }

    recordCandidate({
      bar,
      vwap: vwapResult.vwap,
      marketPass: true,
      volumeRatio: round6(ratio),
      qualified: true,
    });
    const candidate: Candidate = {
      bar,
      vwap: round6(vwapResult.vwap),
      market: { close: indexClose, emaFast, emaSlow },
      volume: { slot: slotKey, median: medianVolume, ratio: round6(ratio) },
    };
    candidates.push(candidate);
    candidateByStart.set(bar.timestamp.getTime(), candidate);
  }

  if (dataReason) {
    return {
      ...base,
      bars,
      fiveMinute,
      byStart,
      openingRange,
      candidates,
      candidateByStart,
      diagnosticsCandidates: diagnosticCandidates,
      skippedReason: dataReason,
    };
  }

  const noSignalReason: EvaluationReasonCode =
    breakoutCount === 0
      ? 'no_breakout'
      : belowVwapCount > 0
        ? 'below_vwap'
        : marketFailCount > 0
          ? 'market_filter'
          : volumeFailCount > 0
            ? 'volume_filter'
            : 'no_breakout';

  return {
    ...base,
    bars,
    fiveMinute,
    byStart,
    openingRange,
    candidates,
    candidateByStart,
    diagnosticsCandidates: diagnosticCandidates,
    noSignalReason,
  };
}

function sessionWindow(context: StrategySessionContext): StrategySessionWindow {
  return context.session;
}

function buildEvidence(input: {
  context: StrategySessionContext;
  openingRange: { high: number; low: number };
  decisionBar: FiveMinuteBar | Bar;
  vwap: number | null;
  market: { close: number; emaFast: number; emaSlow: number } | null;
  volume: { slot: string; median: number; ratio: number } | null;
  pricing: StrategySignalEvidence['pricing'];
  sizing: StrategySignalEvidence['sizing'];
  exitPlan: StrategySignalEvidence['exitPlan'];
  referencePrice: number;
}): StrategySignalEvidence {
  const { context } = input;
  const session = sessionWindow(context);
  const decision = input.decisionBar;
  return {
    evidenceVersion: 1,
    strategy: {
      code: ORB_STRATEGY_CODE,
      codeRef: context.codeRef,
      parameterHash: context.parameterHash,
    },
    session: {
      tradingDate: session.tradingDate,
      open: istTime(session.open),
      close: istTime(session.close),
    },
    openingRange: input.openingRange,
    decisionBar: {
      start: decision.timestamp.toISOString(),
      open: decision.open,
      high: decision.high,
      low: decision.low,
      close: decision.close,
      volume: decision.volume,
    },
    vwap: input.vwap,
    market: input.market
      ? {
          symbol: context.indexInstrument.symbol,
          close: input.market.close,
          emaFast: input.market.emaFast,
          emaSlow: input.market.emaSlow,
        }
      : null,
    volume: input.volume,
    pricing: input.pricing,
    sizing: input.sizing,
    exitPlan: input.exitPlan,
  };
}

function openPosition(
  context: StrategySessionContext,
  params: ReturnType<typeof resolveOrbParameters>,
  risk: RiskParameters,
  candidate: Candidate,
  instrument: StrategyInstrument,
  openingRange: { high: number; low: number },
): { position: OpenPosition; signal: StrategySignal } | { reason: EvaluationReasonCode } {
  const tickSize = instrument.tickSize;
  const entryPrice = ceilToTick(
    candidate.bar.close + params.entryProtectionTicks * tickSize,
    tickSize,
  );
  const stopPrice = floorToTick(candidate.bar.low - tickSize, tickSize);
  const riskPerShare = round6(entryPrice - stopPrice);
  if (riskPerShare <= 0) return { reason: 'invalid_stop' };
  const targetPrice = nearestTick(entryPrice + params.targetRMultiple * riskPerShare, tickSize);

  const riskBudget = context.initialCapital * risk.riskPerTradePct;
  const byRisk = Math.floor(riskBudget / riskPerShare);
  const byCash = Math.floor(context.initialCapital / entryPrice);
  const quantity = Math.min(byRisk, byCash);
  if (quantity < 1) return { reason: 'unsizeable' };

  const evidence = buildEvidence({
    context,
    openingRange,
    decisionBar: candidate.bar,
    vwap: candidate.vwap,
    market: candidate.market,
    volume: candidate.volume,
    pricing: {
      tickSize,
      referencePrice: candidate.bar.close,
      entryPrice,
      stopPrice,
      targetPrice,
      riskPerShare,
    },
    sizing: {
      initialCapital: context.initialCapital,
      riskPerTradePct: risk.riskPerTradePct,
      byRisk,
      byCash,
      quantity,
    },
    exitPlan: {
      stopMode: params.stopMode,
      targetRMultiple: params.targetRMultiple,
    },
    referencePrice: candidate.bar.close,
  });

  const signal: StrategySignal = {
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    signalAt: new Date(candidate.bar.timestamp.getTime() + FIVE_MINUTES_MS),
    candleStart: candidate.bar.timestamp,
    signalType: 'entry',
    side: 'long',
    referencePrice: candidate.bar.close,
    entryPrice,
    stopPrice,
    targetPrice,
    quantity,
    evidence,
  };

  return {
    position: {
      instrument,
      entrySignal: signal,
      decisionBar: candidate.bar,
      nextExitAt: new Date(candidate.bar.timestamp.getTime() + FIVE_MINUTES_MS),
    },
    signal,
  };
}

function eodExit(
  context: StrategySessionContext,
  position: OpenPosition,
  params: ReturnType<typeof resolveOrbParameters>,
): ExitResult | null {
  const bars = context.bars.get(position.instrument.id) ?? [];
  const eodMinutes = params.eodExitTime;
  const eodBar = bars.find(
    (bar) =>
      bar.timeframe === '1m' &&
      istClock(bar.timestamp).date === context.session.tradingDate &&
      istTime(bar.timestamp) === eodMinutes,
  );
  const lastBar = [...bars]
    .filter(
      (bar) =>
        bar.timeframe === '1m' &&
        istClock(bar.timestamp).date === context.session.tradingDate &&
        bar.timestamp.getTime() <
          istInstant(context.session.tradingDate, eodMinutes).getTime(),
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .at(-1);

  const chosen = eodBar ?? lastBar;
  if (!chosen) return null;

  const price = eodBar ? eodBar.open : chosen.close;
  const rounded = nearestTick(price, position.instrument.tickSize);
  const signal: StrategySignal = {
    ...position.entrySignal,
    signalAt: new Date(chosen.timestamp.getTime() + ONE_MINUTE_MS),
    candleStart: chosen.timestamp,
    signalType: 'eod',
    referencePrice: rounded,
    evidence: {
      ...position.entrySignal.evidence,
      decisionBar: {
        start: chosen.timestamp.toISOString(),
        open: chosen.open,
        high: chosen.high,
        low: chosen.low,
        close: chosen.close,
        volume: chosen.volume,
      },
      pricing: position.entrySignal.evidence.pricing
        ? { ...position.entrySignal.evidence.pricing, referencePrice: rounded }
        : null,
    },
  };
  return { signal, bar: chosen, price: rounded };
}

function stopOrTargetExit(
  context: StrategySessionContext,
  position: OpenPosition,
  bars: readonly Bar[],
): ExitResult | null {
  const stop = position.entrySignal.stopPrice;
  const target = position.entrySignal.targetPrice;
  for (const bar of bars) {
    if (bar.timeframe !== '1m') continue;
    const stopHit = bar.low <= stop;
    const targetHit = bar.high >= target;
    if (!stopHit && !targetHit) continue;

    // Stop first when both are touched: conservative and deterministic.
    const type = stopHit ? 'stop' : 'target';
    const rawPrice = stopHit
      ? bar.open <= stop
        ? bar.open
        : stop
      : bar.open >= target
        ? bar.open
        : target;
    const price = nearestTick(rawPrice, position.instrument.tickSize);
    const signal: StrategySignal = {
      ...position.entrySignal,
      signalAt: new Date(bar.timestamp.getTime() + ONE_MINUTE_MS),
      candleStart: bar.timestamp,
      signalType: type,
      referencePrice: price,
      evidence: {
        ...position.entrySignal.evidence,
        decisionBar: {
          start: bar.timestamp.toISOString(),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
        },
        vwap: cumulativeVwap(
          context.bars.get(position.instrument.id) ?? [],
          context.session.open,
          bar.timestamp,
        ).vwap,
        pricing: position.entrySignal.evidence.pricing
          ? { ...position.entrySignal.evidence.pricing, referencePrice: price }
          : null,
      },
    };
    return { signal, bar, price };
  }
  return null;
}

export function evaluateOrbSession(context: StrategySessionContext): StrategyEvaluation {
  const params = resolveOrbParameters(context.parameters);
  const risk: RiskParameters = {
    riskPerTradePct: context.risk.riskPerTradePct,
    maxOpenPositions: context.risk.maxOpenPositions,
    maxEntriesPerDay: context.risk.maxEntriesPerDay,
  };
  const instruments = [...context.instruments].sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );
  const unverifiableExit = new Set(context.unverifiableExitInstruments ?? []);
  const signals: StrategySignal[] = [];

  if (!isNormalSession(context.session.open, context.session.close)) {
    return {
      signals: [],
      results: instruments.map((instrument) =>
        result(instrument, 'skipped', 'special_session', reasonDiagnostics(context, 'special_session')),
      ),
    };
  }

  if (!context.indexInstrument || !validTick(context.indexInstrument.tickSize)) {
    return {
      signals: [],
      results: instruments.map((instrument) =>
        result(instrument, 'skipped', 'index_missing', reasonDiagnostics(context, 'index_missing')),
      ),
    };
  }

  const openingStart = istInstant(context.session.tradingDate, params.openingRangeStart);
  const openingEnd = istInstant(context.session.tradingDate, params.openingRangeEnd);
  const entryStart = istInstant(context.session.tradingDate, params.entryWindowStart);
  const entryEnd = istInstant(context.session.tradingDate, params.entryWindowEnd);
  const aligned =
    openingStart.getTime() % FIVE_MINUTES_MS === 0 &&
    openingEnd.getTime() % FIVE_MINUTES_MS === 0 &&
    entryStart.getTime() % FIVE_MINUTES_MS === 0 &&
    entryEnd.getTime() % FIVE_MINUTES_MS === 0 &&
    openingEnd > openingStart &&
    entryEnd > entryStart;

  if (!aligned) {
    return {
      signals: [],
      results: instruments.map((instrument) =>
        result(
          instrument,
          'skipped',
          'opening_range_incomplete',
          reasonDiagnostics(context, 'opening_range_incomplete', {
            note: 'Opening-range and entry-window endpoints must align to five-minute boundaries.',
          }),
        ),
      ),
    };
  }

  const openingSlots = expectedSlots(openingStart, openingEnd);
  const decisionSlots = expectedSlots(entryStart, entryEnd);

  const indexBars = rollupFiveMinuteBars(
    context.indexBars.filter(
      (bar) => bar.timeframe === '1m' && bar.timestamp.getTime() < context.session.close.getTime(),
    ),
  );
  const completeIndexBars = indexBars.filter((bar) => bar.complete);
  const indexByStart = new Map(completeIndexBars.map((bar) => [bar.timestamp.getTime(), bar]));

  if (completeIndexBars.length < params.emaLookbackBars) {
    return {
      signals: [],
      results: instruments.map((instrument) =>
        result(instrument, 'skipped', 'warmup', reasonDiagnostics(context, 'warmup')),
      ),
    };
  }

  const missingDecisionIndex = decisionSlots.some((slot) => !indexByStart.has(slot.getTime()));
  if (missingDecisionIndex) {
    return {
      signals: [],
      results: instruments.map((instrument) =>
        result(
          instrument,
          'skipped',
          'index_data_gap',
          reasonDiagnostics(context, 'index_data_gap'),
        ),
      ),
    };
  }

  const analyses = new Map<string, InstrumentAnalysis>();
  for (const instrument of instruments) {
    analyses.set(
      instrument.id,
      analyzeInstrument(context, instrument, params, {
        indexBars: completeIndexBars,
        indexByStart,
        openingSlots,
        decisionSlots,
        volumeHistory: context.volumeHistory.get(instrument.id) ?? [],
      }),
    );
  }

  const maxEntriesPerDay = Math.max(
    1,
    Math.min(params.maxEntriesPerDay, risk.maxEntriesPerDay),
  );
  const maxEntriesPerStock = Math.max(1, params.maxEntriesPerStockPerSession);
  const entriesByInstrument = new Map<string, number>();
  const blockedReason = new Map<string, EvaluationReasonCode>();
  let entriesToday = 0;
  let open: OpenPosition | null = null;

  const block = (instrumentId: string, reason: EvaluationReasonCode) => {
    if (!blockedReason.has(instrumentId)) blockedReason.set(instrumentId, reason);
  };

  const processExits = (exclusiveEnd: Date): void => {
    if (!open) return;
    const bars = (context.bars.get(open.instrument.id) ?? []).filter(
      (bar) => bar.timeframe === '1m',
    );
    const window = barsBetween(bars, open.nextExitAt, exclusiveEnd);
    const exit = stopOrTargetExit(context, open, window);
    if (exit) {
      signals.push(exit.signal);
      open = null;
    }
  };

  for (const slot of decisionSlots) {
    const slotEnd = new Date(slot.getTime() + FIVE_MINUTES_MS);
    processExits(slotEnd);

    const candidatesThisSlot: Array<{ analysis: InstrumentAnalysis; candidate: Candidate }> = [];
    for (const instrument of instruments) {
      const analysis = analyses.get(instrument.id);
      if (!analysis || analysis.skippedReason) continue;
      const candidate = analysis.candidateByStart.get(slot.getTime());
      if (!candidate) continue;
      if (unverifiableExit.has(instrument.id)) {
        // A position opened here could run into the unobserved exit window, so the
        // entry is withheld rather than evaluated against an incomplete bar path.
        block(instrument.id, 'exit_window_incomplete');
        continue;
      }
      if ((entriesByInstrument.get(instrument.id) ?? 0) >= maxEntriesPerStock) {
        block(instrument.id, 'already_traded');
        continue;
      }
      candidatesThisSlot.push({ analysis, candidate });
    }

    if (candidatesThisSlot.length === 0) continue;

    if (open) {
      for (const { analysis } of candidatesThisSlot) block(analysis.instrument.id, 'position_open');
      continue;
    }

    if (entriesToday >= maxEntriesPerDay) {
      for (const { analysis } of candidatesThisSlot) block(analysis.instrument.id, 'daily_limit');
      continue;
    }

    candidatesThisSlot.sort(
      (a, b) =>
        b.candidate.volume.ratio - a.candidate.volume.ratio ||
        a.analysis.instrument.symbol.localeCompare(b.analysis.instrument.symbol),
    );
    const selected = candidatesThisSlot[0]!;
    for (const loser of candidatesThisSlot.slice(1)) {
      // The single selected entry occupies the only slot in R3, so the loser was not skipped
      // for a rule it failed; it lost the portfolio race.
      block(loser.analysis.instrument.id, 'position_open');
    }

    const openingRange = selected.analysis.openingRange;
    if (!openingRange) {
      block(selected.analysis.instrument.id, 'opening_range_incomplete');
      continue;
    }

    const opened = openPosition(
      context,
      params,
      risk,
      selected.candidate,
      selected.analysis.instrument,
      openingRange,
    );
    if ('reason' in opened) {
      block(selected.analysis.instrument.id, opened.reason);
      continue;
    }

    signals.push(opened.signal);
    open = opened.position;
    entriesToday += 1;
    entriesByInstrument.set(
      selected.analysis.instrument.id,
      (entriesByInstrument.get(selected.analysis.instrument.id) ?? 0) + 1,
    );
  }

  if (open) {
    const eodInstant = istInstant(context.session.tradingDate, params.eodExitTime);
    processExits(eodInstant);
    if (open) {
      const exit = eodExit(context, open, params);
      if (exit) {
        signals.push(exit.signal);
        open = null;
      }
    }
  }

  const results = instruments.map((instrument) => {
    const analysis = analyses.get(instrument.id)!;
    const instrumentSignals = signals.filter((signal) => signal.instrumentId === instrument.id);
    const portfolio = {
      entries: entriesByInstrument.get(instrument.id) ?? 0,
      openPositions: open?.instrument.id === instrument.id ? 1 : 0,
    };

    if (analysis.skippedReason) {
      const reason = analysis.skippedReason;
      return result(
        instrument,
        'skipped',
        reason,
        reasonDiagnostics(context, reason, {
          openingRange: analysis.openingRange,
          candidates: analysis.diagnosticsCandidates,
          portfolio,
          note: analysis.note,
        }),
      );
    }

    if (instrumentSignals.length > 0) {
      return result(
        instrument,
        'signal',
        null,
        reasonDiagnostics(context, null, {
          openingRange: analysis.openingRange,
          candidates: analysis.diagnosticsCandidates,
          portfolio,
        }),
      );
    }

    const reason = blockedReason.get(instrument.id) ?? analysis.noSignalReason ?? 'no_breakout';
    return result(
      instrument,
      'no_signal',
      reason,
      reasonDiagnostics(context, reason, {
        openingRange: analysis.openingRange,
        candidates: analysis.diagnosticsCandidates,
        portfolio,
      }),
    );
  });

  signals.sort(
    (a, b) =>
      a.signalAt.getTime() - b.signalAt.getTime() ||
      a.symbol.localeCompare(b.symbol) ||
      a.signalType.localeCompare(b.signalType),
  );
  return { signals, results };
}

/** Exposed for the golden tests; the defaults are part of the contract. */
export function orbLimits(
  parameters: OrbParameters,
  risk: RiskParameters,
): { maxEntriesPerDay: number; maxOpenPositions: number } {
  return {
    maxEntriesPerDay: Math.max(1, Math.min(parameters.maxEntriesPerDay, risk.maxEntriesPerDay)),
    maxOpenPositions: Math.max(
      1,
      Math.min(parameters.maxOpenPositions, risk.maxOpenPositions, ORB_MAX_OPEN_POSITIONS),
    ),
  };
}
