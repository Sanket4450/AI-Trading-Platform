import { describe, expect, it } from 'vitest';
import { canonicalJson, hashPayload } from './hashing.js';

describe('canonical configuration hashing', () => {
  it('sorts object keys recursively', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it('produces the same hash regardless of key insertion order', () => {
    const left = { riskPerTradePct: 0.005, limits: { daily: 0.01, entries: 2 } };
    const right = { limits: { entries: 2, daily: 0.01 }, riskPerTradePct: 0.005 };
    expect(hashPayload(left)).toBe(hashPayload(right));
  });

  it('preserves array order', () => {
    expect(hashPayload({ values: [1, 2] })).not.toBe(hashPayload({ values: [2, 1] }));
  });

  it('rejects undefined and non-finite numbers', () => {
    expect(() => canonicalJson({ value: undefined })).toThrow(/undefined/);
    expect(() => canonicalJson({ value: Number.NaN })).toThrow(/NaN/);
  });
});
