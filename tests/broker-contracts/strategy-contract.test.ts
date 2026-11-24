import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ORB_CODE_REF,
  ORB_PARAMETER_SCHEMA,
  ORB_STRATEGY_CODE,
} from '@ai-trading/domain';
import {
  listRegisteredStrategies,
  openingRangeBreakout,
  resolveStrategyRuntime,
} from '@ai-trading/strategies';
import { syntheticSession } from './orb-fixture.js';

function strategySource(relative: string): string {
  return readFileSync(new URL(`../../packages/strategies/${relative}`, import.meta.url), 'utf8');
}

describe('shared strategy contract', () => {
  it('exposes the opening-range-breakout identity and version', () => {
    expect(openingRangeBreakout.code).toBe(ORB_STRATEGY_CODE);
    expect(openingRangeBreakout.implementation).toBe('opening-range-breakout');
    expect(openingRangeBreakout.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(listRegisteredStrategies().map((strategy) => strategy.code)).toContain('orb-15m');
  });

  it('resolves the seeded version to the registered implementation', () => {
    const runtime = resolveStrategyRuntime({
      code: ORB_STRATEGY_CODE,
      codeRef: ORB_CODE_REF,
      parameterSchema: ORB_PARAMETER_SCHEMA,
    });
    expect(runtime.status).toBe('registered');
    expect(runtime.schemaMatches).toBe(true);
  });

  it('returns a research signal, not an empty array, for a synthetic session', () => {
    const evaluation = openingRangeBreakout.evaluate(syntheticSession());
    expect(evaluation.signals.map((signal) => signal.signalType)).toEqual(['entry', 'target']);
    expect(evaluation.results[0]?.status).toBe('signal');
    expect(evaluation.signals[0]?.evidence.pricing?.entryPrice).toBe(101.05);
  });

  it('keeps database, queue and framework imports out of the strategy package', () => {
    const sources = [
      strategySource('index.ts'),
      strategySource('registry.ts'),
      strategySource('parameters.ts'),
      strategySource('opening-range-breakout/strategy.ts'),
      strategySource('opening-range-breakout/evaluator.ts'),
    ].join('\n');
    for (const dependency of [
      '@ai-trading/database',
      '@nestjs/',
      'bullmq',
      'drizzle-orm',
      'postgres',
    ]) {
      expect(sources).not.toContain(dependency);
    }
  });
});
