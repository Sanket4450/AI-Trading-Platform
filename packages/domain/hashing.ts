import { createHash } from 'node:crypto';

function normalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Configuration payloads cannot contain NaN or Infinity');
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const child = record[key];
      if (child === undefined) {
        throw new TypeError(`Configuration payload key "${key}" is undefined`);
      }
      sorted[key] = normalize(child);
    }
    return sorted;
  }

  throw new TypeError(`Unsupported configuration value: ${typeof value}`);
}

/** Deterministic JSON: object keys sorted recursively, array order preserved. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashPayload(payload: unknown): string {
  return sha256Hex(canonicalJson(payload));
}
