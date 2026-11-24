import type { Bar, VolumeSlotSample } from '@ai-trading/domain';
import { ORB_PARAMETER_DEFAULTS } from '@ai-trading/domain';
import type { StrategySessionContext } from '@ai-trading/trading-engine';
import {
  addMinutes,
  istInstant,
  istTime,
} from '@ai-trading/trading-engine';

export const TEST_DATE = '2026-01-05';
const PRIOR_INDEX_DATES = ['2026-01-01', '2026-01-02', '2026-01-03'];

export interface SlotPlan {
  close: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface MinuteOverride {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface InstrumentPlan {
  id: string;
  symbol: string;
  tickSize: number;
  opening: SlotPlan[];
  decisions: Record<string, SlotPlan>;
  overrides?: Record<string, MinuteOverride>;
}

function slotStarts(date: string): { time: string; start: Date }[] {
  const slots: { time: string; start: Date }[] = [];
  let cursor = istInstant(date, '09:15');
  const close = istInstant(date, '15:30');
  while (cursor < close) {
    slots.push({ time: istTime(cursor), start: cursor });
    cursor = addMinutes(cursor, 5);
  }
  return slots;
}

function planFor(slot: number, opening: SlotPlan[], decisions: Record<string, SlotPlan>, time: string): SlotPlan {
  if (slot < 3) return opening[slot] ?? { close: 100, volume: 500 };
  return decisions[time] ?? { close: 100, volume: 500 };
}

function makeBars(plan: InstrumentPlan, date: string): Bar[] {
  const bars: Bar[] = [];
  const slots = slotStarts(date);
  for (const [index, slot] of slots.entries()) {
    const slotPlan = planFor(index, plan.opening, plan.decisions, slot.time);
    const high = slotPlan.high ?? slotPlan.close + 0.05;
    const low = slotPlan.low ?? slotPlan.close - 0.05;
    const volume = slotPlan.volume ?? 500;
    for (let minute = 0; minute < 5; minute += 1) {
      const at = addMinutes(slot.start, minute);
      const override = plan.overrides?.[istTime(at)] ?? {};
      const close = override.close ?? slotPlan.close;
      bars.push({
        instrument: plan.symbol,
        timeframe: '1m',
        timestamp: at,
        open: override.open ?? close,
        high: override.high ?? high,
        low: override.low ?? low,
        close,
        volume: override.volume ?? volume / 5,
      });
    }
  }
  return bars;
}

function indexBarsFor(date: string, start: number, driftPerBar: number): Bar[] {
  const bars: Bar[] = [];
  const slots = slotStarts(date);
  let index = 0;
  for (const slot of slots) {
    for (let minute = 0; minute < 5; minute += 1) {
      const price = start + driftPerBar * index;
      const at = addMinutes(slot.start, minute);
      bars.push({
        instrument: 'NIFTY 50',
        timeframe: '1m',
        timestamp: at,
        open: price,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000,
      });
      index += 1;
    }
  }
  return bars;
}

function continuousIndexBars(
  dates: readonly string[],
  start: number,
  driftPerBar: number,
): Bar[] {
  const bars: Bar[] = [];
  let price = start;
  for (const date of dates) {
    bars.push(...indexBarsFor(date, price, driftPerBar));
    price += driftPerBar * 375;
  }
  return bars;
}

export function buildVolumeHistory(input: {
  instrumentIds: string[];
  slotTimes?: string[];
  sessions?: number;
  volume?: number;
}): Map<string, VolumeSlotSample[]> {
  const result = new Map<string, VolumeSlotSample[]>();
  const slots =
    input.slotTimes ??
    slotStarts(TEST_DATE)
      .map((slot) => slot.time)
      .filter((time) => time >= '09:30' && time <= '14:10');
  const sessions = input.sessions ?? 20;
  for (const instrumentId of input.instrumentIds) {
    const samples: VolumeSlotSample[] = [];
    for (let day = 0; day < sessions; day += 1) {
      const tradingDate = `2025-12-${String(day + 1).padStart(2, '0')}`;
      for (const slot of slots) {
        samples.push({ tradingDate, slot, volume: input.volume ?? 1000 });
      }
    }
    result.set(instrumentId, samples);
  }
  return result;
}

export function buildContext(input: {
  plans: InstrumentPlan[];
  date?: string;
  indexTrend?: 'up' | 'down';
  volumeHistory?: Map<string, VolumeSlotSample[]>;
  initialCapital?: number;
  parameters?: Partial<typeof ORB_PARAMETER_DEFAULTS>;
  risk?: Partial<{ riskPerTradePct: number; maxOpenPositions: number; maxEntriesPerDay: number }>;
  withIndex?: boolean;
}): StrategySessionContext {
  const date = input.date ?? TEST_DATE;
  const bars = new Map<string, Bar[]>();
  const instruments = input.plans.map((plan) => {
    bars.set(plan.id, makeBars(plan, date));
    return { id: plan.id, symbol: plan.symbol, tickSize: plan.tickSize };
  });

  const indexBars = input.withIndex === false
    ? []
    : continuousIndexBars(
        [...PRIOR_INDEX_DATES, date],
        input.indexTrend === 'down' ? 21_000 : 19_000,
        input.indexTrend === 'down' ? -10 : 10,
      );

  return {
    runAt: new Date('2026-01-05T12:00:00.000Z'),
    session: {
      tradingDate: date,
      open: istInstant(date, '09:15'),
      close: istInstant(date, '15:30'),
    },
    instruments,
    bars,
    indexBars,
    indexInstrument: { id: 'index', symbol: 'NIFTY 50', tickSize: 0.05 },
    volumeHistory: input.volumeHistory ?? buildVolumeHistory({ instrumentIds: instruments.map((i) => i.id) }),
    initialCapital: input.initialCapital ?? 1_000_000,
    parameters: {
      ...ORB_PARAMETER_DEFAULTS,
      ...input.parameters,
    },
    risk: {
      riskPerTradePct: 0.005,
      maxOpenPositions: 1,
      maxEntriesPerDay: 2,
      ...input.risk,
    },
    codeRef: 'opening-range-breakout@1.0.0',
    parameterHash: 'test-hash',
    coverage: {
      expectedBars: 375,
      storedBars: 375,
      indexExpectedBars: 375,
      indexStoredBars: 375,
    },
  };
}

export function breakoutPlan(
  overrides: Partial<InstrumentPlan> & Pick<InstrumentPlan, 'id' | 'symbol'>,
): InstrumentPlan {
  return {
    tickSize: 0.05,
    opening: [
      { close: 100, high: 100.05, low: 99.95, volume: 1000 },
      { close: 100, high: 100.05, low: 99.95, volume: 1000 },
      { close: 100, high: 100.05, low: 99.95, volume: 1000 },
    ],
    decisions: {
      '09:30': { close: 101, high: 101.05, low: 100.95, volume: 5000 },
    },
    ...overrides,
  };
}
