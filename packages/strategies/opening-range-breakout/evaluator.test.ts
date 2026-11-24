import { describe, expect, it } from 'vitest';
import { evaluateOrbSession } from '../index.js';
import { breakoutPlan, buildContext, TEST_DATE } from '../test/orb-fixtures.js';

describe('ORB session evaluator', () => {
  it('enters on a confirmed breakout and exits at the target', () => {
    const plan = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      overrides: {
        '09:35': { open: 101.1, high: 102, low: 101, close: 101.5, volume: 1000 },
      },
    });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan] }));

    expect(evaluation.results).toHaveLength(1);
    expect(evaluation.results[0]?.status).toBe('signal');
    expect(evaluation.signals.map((signal) => signal.signalType)).toEqual(['entry', 'target']);

    const entry = evaluation.signals[0]!;
    expect(entry.entryPrice).toBe(101.05);
    expect(entry.stopPrice).toBe(100.9);
    expect(entry.targetPrice).toBe(101.3);
    expect(entry.quantity).toBe(9896);
    expect(entry.signalAt.toISOString()).toBe(
      new Date(`${TEST_DATE}T04:05:00.000Z`).toISOString(),
    );
    expect(entry.candleStart.toISOString()).toBe(
      new Date(`${TEST_DATE}T04:00:00.000Z`).toISOString(),
    );
    expect(evaluation.signals[1]?.referencePrice).toBe(101.3);
  });

  it('reports no breakout when every decision bar stays inside the range', () => {
    const plan = breakoutPlan({ id: 'aaa', symbol: 'AAA', decisions: {} });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan] }));

    expect(evaluation.signals).toEqual([]);
    expect(evaluation.results[0]?.status).toBe('no_signal');
    expect(evaluation.results[0]?.reasonCode).toBe('no_breakout');
  });

  it('fails the market filter when the index trend is down', () => {
    const plan = breakoutPlan({ id: 'aaa', symbol: 'AAA' });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan], indexTrend: 'down' }));

    expect(evaluation.signals).toEqual([]);
    expect(evaluation.results[0]?.reasonCode).toBe('market_filter');
  });

  it('fails the volume filter when the decision bar is below the multiple', () => {
    const plan = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      decisions: { '09:30': { close: 101, high: 101.05, low: 100.95, volume: 1000 } },
    });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan] }));

    expect(evaluation.signals).toEqual([]);
    expect(evaluation.results[0]?.reasonCode).toBe('volume_filter');
  });

  it('accepts a 14:10 bar and rejects a 14:15 bar', () => {
    const accepted = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      decisions: { '14:10': { close: 101, high: 101.05, low: 100.95, volume: 5000 } },
    });
    expect(
      evaluateOrbSession(buildContext({ plans: [accepted] })).signals.map((s) => s.signalType),
    ).toContain('entry');

    const rejected = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      decisions: { '14:15': { close: 101, high: 101.05, low: 100.95, volume: 5000 } },
    });
    const evaluation = evaluateOrbSession(buildContext({ plans: [rejected] }));
    expect(evaluation.signals).toEqual([]);
    expect(evaluation.results[0]?.reasonCode).toBe('no_breakout');
  });

  it('takes the stop when stop and target are touched in one bar', () => {
    const plan = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      overrides: {
        '09:35': { open: 101, high: 103, low: 99, close: 100, volume: 1000 },
      },
    });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan] }));
    const exit = evaluation.signals.find((signal) => signal.signalType !== 'entry');
    expect(exit?.signalType).toBe('stop');
    expect(exit?.referencePrice).toBe(100.9);
  });

  it('exits at 15:15 when neither stop nor target is touched', () => {
    const plan = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      decisions: { '09:30': { close: 101, high: 101.05, low: 99, volume: 5000 } },
    });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan] }));
    const exit = evaluation.signals.find((signal) => signal.signalType !== 'entry');
    expect(exit?.signalType).toBe('eod');
    expect(exit?.candleStart.toISOString()).toBe(
      new Date(`${TEST_DATE}T09:45:00.000Z`).toISOString(),
    );
  });

  it('holds one open position and records position_open for the other candidate', () => {
    const first = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      decisions: { '09:30': { close: 101, high: 101.05, low: 100.95, volume: 6000 } },
    });
    const second = breakoutPlan({
      id: 'bbb',
      symbol: 'BBB',
      decisions: { '09:30': { close: 101, high: 101.05, low: 100.95, volume: 5000 } },
    });
    const evaluation = evaluateOrbSession(buildContext({ plans: [first, second] }));
    const bySymbol = new Map(evaluation.results.map((result) => [result.symbol, result]));

    expect(bySymbol.get('AAA')?.status).toBe('signal');
    expect(bySymbol.get('BBB')?.status).toBe('no_signal');
    expect(bySymbol.get('BBB')?.reasonCode).toBe('position_open');
    expect(evaluation.signals).toHaveLength(2);
  });

  it('allows a second entry after the first exits when the daily limit permits it', () => {
    const first = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      overrides: {
        '09:35': { open: 101.1, high: 102, low: 101, close: 101.5, volume: 1000 },
      },
    });
    const second = breakoutPlan({
      id: 'bbb',
      symbol: 'BBB',
      decisions: { '09:40': { close: 101, high: 101.05, low: 100.95, volume: 5000 } },
    });
    const evaluation = evaluateOrbSession(buildContext({ plans: [first, second] }));

    const entries = evaluation.signals.filter((signal) => signal.signalType === 'entry');
    expect(entries.map((signal) => signal.symbol)).toEqual(['AAA', 'BBB']);
    expect(evaluation.results.find((r) => r.symbol === 'BBB')?.status).toBe('signal');
  });

  it('reports unsizeable when the risk budget does not buy one share', () => {
    const plan = breakoutPlan({ id: 'aaa', symbol: 'AAA' });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan], initialCapital: 100 }));

    expect(evaluation.signals).toEqual([]);
    expect(evaluation.results[0]?.reasonCode).toBe('unsizeable');
  });

  it('skips an instrument with an invalid tick size', () => {
    const plan = breakoutPlan({ id: 'aaa', symbol: 'AAA', tickSize: 0 });
    const evaluation = evaluateOrbSession(buildContext({ plans: [plan] }));

    expect(evaluation.results[0]?.status).toBe('skipped');
    expect(evaluation.results[0]?.reasonCode).toBe('invalid_tick');
  });

  it('skips a special session without shifting the clock rules', () => {
    const plan = breakoutPlan({ id: 'aaa', symbol: 'AAA' });
    const context = buildContext({ plans: [plan] });
    const special = {
      ...context,
      session: {
        ...context.session,
        open: new Date(`${TEST_DATE}T03:20:00.000Z`),
        close: new Date(`${TEST_DATE}T04:30:00.000Z`),
      },
    };
    const evaluation = evaluateOrbSession(special);

    expect(evaluation.results[0]?.status).toBe('skipped');
    expect(evaluation.results[0]?.reasonCode).toBe('special_session');
  });

  it('skips when the opening range is incomplete', () => {
    const plan = breakoutPlan({ id: 'aaa', symbol: 'AAA' });
    const context = buildContext({ plans: [plan] });
    const bars = new Map(context.bars);
    bars.set(
      'aaa',
      (context.bars.get('aaa') ?? []).filter(
        (bar) => bar.timestamp.toISOString() !== `${TEST_DATE}T03:46:00.000Z`,
      ),
    );
    const evaluation = evaluateOrbSession({ ...context, bars });

    expect(evaluation.results[0]?.status).toBe('skipped');
    expect(evaluation.results[0]?.reasonCode).toBe('opening_range_incomplete');
  });

  it('skips when the index is missing', () => {
    const plan = breakoutPlan({ id: 'aaa', symbol: 'AAA' });
    const context = buildContext({ plans: [plan], withIndex: false });
    const evaluation = evaluateOrbSession(context);

    expect(evaluation.results[0]?.reasonCode).toBe('warmup');
  });

  it('is deterministic for identical inputs', () => {
    const plan = breakoutPlan({
      id: 'aaa',
      symbol: 'AAA',
      overrides: {
        '09:35': { open: 101.1, high: 102, low: 101, close: 101.5, volume: 1000 },
      },
    });
    const context = buildContext({ plans: [plan] });
    expect(JSON.stringify(evaluateOrbSession(context))).toBe(
      JSON.stringify(evaluateOrbSession(context)),
    );
  });
});
