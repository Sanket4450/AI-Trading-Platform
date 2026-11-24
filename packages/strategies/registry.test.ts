import { describe, expect, it } from 'vitest';
import {
  ORB_CODE_REF,
  ORB_PARAMETER_DEFAULTS,
  ORB_PARAMETER_SCHEMA,
  ORB_STRATEGY_CODE,
} from '@ai-trading/domain';
import {
  parseCodeRef,
  registeredStrategy,
  resolveStrategyRuntime,
  validateStrategyParameters,
} from './index.js';

const schema = ORB_PARAMETER_SCHEMA as unknown as Record<string, unknown>;

const validPayload = {
  strategy: ORB_STRATEGY_CODE,
  openingRangeStart: '09:15',
  openingRangeEnd: '09:30',
  signalTimeframe: '5m',
  entryWindowStart: '09:30',
  entryWindowEnd: '14:15',
  emaFastPeriod: 20,
  emaSlowPeriod: 50,
  vwapConfirmation: true,
  volumeLookbackSessions: 20,
  volumeRatioMin: 1.5,
  stopMode: 'breakout_candle_low_minus_tick',
  targetRMultiple: 1.5,
  maxEntriesPerStockPerSession: 1,
  maxEntriesPerDay: 2,
  maxOpenPositions: 1,
  eodExitTime: '15:15',
  priceProtection: true,
};

describe('strategy registry', () => {
  it('resolves the seeded ORB version', () => {
    const runtime = resolveStrategyRuntime({
      code: ORB_STRATEGY_CODE,
      codeRef: ORB_CODE_REF,
      parameterSchema: ORB_PARAMETER_SCHEMA,
    });
    expect(runtime.status).toBe('registered');
    expect(runtime.implementation).toBe('opening-range-breakout');
    expect(runtime.implementationVersion).toBe('1.0.0');
    expect(runtime.schemaMatches).toBe(true);
    expect(registeredStrategy(ORB_STRATEGY_CODE)?.code).toBe(ORB_STRATEGY_CODE);
  });

  it('parses implementation@version', () => {
    expect(parseCodeRef(ORB_CODE_REF)).toEqual({
      implementation: 'opening-range-breakout',
      version: '1.0.0',
    });
    expect(parseCodeRef('r1-seed')).toBeNull();
  });

  it('reports each resolution failure separately', () => {
    expect(
      resolveStrategyRuntime({
        code: 'unknown',
        codeRef: ORB_CODE_REF,
        parameterSchema: ORB_PARAMETER_SCHEMA,
      }).status,
    ).toBe('unregistered');

    expect(
      resolveStrategyRuntime({
        code: ORB_STRATEGY_CODE,
        codeRef: 'r1-seed',
        parameterSchema: ORB_PARAMETER_SCHEMA,
      }).status,
    ).toBe('invalid_code_ref');

    expect(
      resolveStrategyRuntime({
        code: ORB_STRATEGY_CODE,
        codeRef: 'opening-range-breakout@9.9.9',
        parameterSchema: ORB_PARAMETER_SCHEMA,
      }).status,
    ).toBe('implementation_missing');

    expect(
      resolveStrategyRuntime({
        code: ORB_STRATEGY_CODE,
        codeRef: ORB_CODE_REF,
        parameterSchema: { type: 'object' },
      }).status,
    ).toBe('schema_mismatch');
  });
});

describe('strategy parameter validation', () => {
  it('accepts the seeded v1 payload, including optional keys', () => {
    expect(validateStrategyParameters(schema, validPayload)).toEqual([]);
    expect(validateStrategyParameters(schema, ORB_PARAMETER_DEFAULTS)).toEqual([]);
  });

  it('rejects an unknown key', () => {
    const errors = validateStrategyParameters(schema, { ...validPayload, surprise: 1 });
    expect(errors.join(' ')).toMatch(/additional properties/i);
  });

  it('rejects a wrong type', () => {
    const errors = validateStrategyParameters(schema, { ...validPayload, emaFastPeriod: '20' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toMatch(/integer|number/i);
  });

  it('rejects an out-of-range value', () => {
    const errors = validateStrategyParameters(schema, { ...validPayload, volumeRatioMin: 0 });
    expect(errors.join(' ')).toMatch(/> 0|exclusive minimum/i);
  });

  it('rejects a malformed time string', () => {
    const errors = validateStrategyParameters(schema, { ...validPayload, entryWindowStart: '9:30' });
    expect(errors.join(' ')).toMatch(/pattern/i);
  });
});
