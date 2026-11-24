import { ORB_PARAMETER_DEFAULTS } from '@ai-trading/domain';
import type { Bar } from '@ai-trading/domain';
import type { StrategySessionContext } from '@ai-trading/trading-engine';
import { addMinutes, istInstant, istTime } from '@ai-trading/trading-engine';

const DATE = '2026-09-01';
const PRIOR = ['2026-08-27', '2026-08-28', '2026-08-31'];

function slots(date: string) {
  const result: { time: string; start: Date }[] = [];
  let cursor = istInstant(date, '09:15');
  const close = istInstant(date, '15:30');
  while (cursor < close) {
    result.push({ time: istTime(cursor), start: cursor });
    cursor = addMinutes(cursor, 5);
  }
  return result;
}

function instrumentBars(symbol: string, breakout: boolean): Bar[] {
  const bars: Bar[] = [];
  for (const [index, slot] of slots(DATE).entries()) {
    const decision = index === 3 && breakout;
    const close = decision ? 101 : 100;
    const volume = decision ? 5000 : 500;
    for (let minute = 0; minute < 5; minute += 1) {
      const at = addMinutes(slot.start, minute);
      const exitBar = breakout && index === 4 && minute === 0;
      const override = exitBar
        ? { open: 101, high: 102, low: 101, close: 101.5, volume: 1000 }
        : null;
      bars.push({
        instrument: symbol,
        timeframe: '1m',
        timestamp: at,
        open: override?.open ?? close,
        high: override?.high ?? close + 0.05,
        low: override?.low ?? close - 0.05,
        close: override?.close ?? close,
        volume: override?.volume ?? volume / 5,
      });
    }
  }
  return bars;
}

function indexBars(): Bar[] {
  const bars: Bar[] = [];
  let price = 20_000;
  for (const date of [...PRIOR, DATE]) {
    for (const slot of slots(date)) {
      for (let minute = 0; minute < 5; minute += 1) {
        bars.push({
          instrument: 'NIFTY 50',
          timeframe: '1m',
          timestamp: addMinutes(slot.start, minute),
          open: price,
          high: price + 0.5,
          low: price - 0.5,
          close: price,
          volume: 1000,
        });
        price += 10;
      }
    }
  }
  return bars;
}

export function syntheticSession(): StrategySessionContext {
  const instruments = [
    { id: 'aaa', symbol: 'AAA', tickSize: 0.05 },
  ];
  const bars = new Map([['aaa', instrumentBars('AAA', true)]]);
  const volumeHistory = new Map(
    instruments.map((instrument) => [
      instrument.id,
      slots(DATE)
        .map((slot) => slot.time)
        .filter((time) => time >= '09:30' && time <= '14:10')
        .flatMap((slot) =>
          Array.from({ length: 20 }, (_, day) => ({
            tradingDate: `2026-08-${String(day + 1).padStart(2, '0')}`,
            slot,
            volume: 500,
          })),
        ),
    ]),
  );

  return {
    runAt: new Date(),
    session: {
      tradingDate: DATE,
      open: istInstant(DATE, '09:15'),
      close: istInstant(DATE, '15:30'),
    },
    instruments,
    bars,
    indexBars: indexBars(),
    indexInstrument: { id: 'index', symbol: 'NIFTY 50', tickSize: 0.05 },
    volumeHistory,
    initialCapital: 1_000_000,
    parameters: ORB_PARAMETER_DEFAULTS,
    risk: { riskPerTradePct: 0.005, maxOpenPositions: 1, maxEntriesPerDay: 2 },
    codeRef: 'opening-range-breakout@1.0.0',
    parameterHash: 'contract',
  };
}
