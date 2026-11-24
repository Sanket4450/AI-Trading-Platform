import { canonicalJson, type JsonSchema, type StrategyRuntimeResolution } from '@ai-trading/domain';
import type { Strategy } from '@ai-trading/trading-engine';
import { openingRangeBreakout } from './opening-range-breakout/strategy.js';

/** Static registry: adding a strategy is a code change plus a database version row. */
const REGISTRY: ReadonlyMap<string, Strategy> = new Map([
  [openingRangeBreakout.code, openingRangeBreakout],
]);

export interface CodeRef {
  readonly implementation: string;
  readonly version: string;
}

export function parseCodeRef(codeRef: string | null | undefined): CodeRef | null {
  if (!codeRef) return null;
  const match = /^([a-z0-9][a-z0-9-]*)@(\d+\.\d+\.\d+)$/i.exec(codeRef.trim());
  if (!match) return null;
  return { implementation: match[1]!, version: match[2]! };
}

export function registeredStrategy(code: string): Strategy | null {
  return REGISTRY.get(code) ?? null;
}

export function listRegisteredStrategies(): Strategy[] {
  return [...REGISTRY.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function deepEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

/**
 * Resolves a database strategy code plus version row to a runtime state. The order matters:
 * an unknown code is unregistered, a malformed code_ref is invalid, and only then do we look for
 * a matching implementation and compare its schema.
 */
export function resolveStrategyRuntime(input: {
  code: string;
  codeRef: string | null;
  parameterSchema: JsonSchema;
}): StrategyRuntimeResolution {
  const strategy = registeredStrategy(input.code);
  const parameterNames = strategy
    ? Object.keys((strategy.parameterSchema.properties as Record<string, unknown>) ?? {})
    : [];

  if (!strategy) {
    return {
      status: 'unregistered',
      code: input.code,
      codeRef: input.codeRef,
      implementation: null,
      implementationVersion: null,
      schemaMatches: null,
      parameterNames: [],
      error: `No registered implementation for strategy code "${input.code}"`,
    };
  }

  const parsed = parseCodeRef(input.codeRef);
  if (!parsed) {
    return {
      status: 'invalid_code_ref',
      code: input.code,
      codeRef: input.codeRef,
      implementation: strategy.implementation,
      implementationVersion: strategy.version,
      schemaMatches: null,
      parameterNames,
      error: 'code_ref must be "implementation@major.minor.patch"',
    };
  }

  if (
    parsed.implementation !== strategy.implementation ||
    parsed.version !== strategy.version
  ) {
    return {
      status: 'implementation_missing',
      code: input.code,
      codeRef: input.codeRef,
      implementation: parsed.implementation,
      implementationVersion: parsed.version,
      schemaMatches: null,
      parameterNames,
      error: `No registered implementation ${parsed.implementation}@${parsed.version}`,
    };
  }

  if (!deepEqual(strategy.parameterSchema, input.parameterSchema)) {
    return {
      status: 'schema_mismatch',
      code: input.code,
      codeRef: input.codeRef,
      implementation: strategy.implementation,
      implementationVersion: strategy.version,
      schemaMatches: false,
      parameterNames,
      error: 'The strategy version parameter schema differs from the registered implementation',
    };
  }

  return {
    status: 'registered',
    code: input.code,
    codeRef: input.codeRef,
    implementation: strategy.implementation,
    implementationVersion: strategy.version,
    schemaMatches: true,
    parameterNames,
    error: null,
  };
}
