export interface JsonDiffEntry {
  path: string;
  left: unknown;
  right: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function diffJson(
  left: unknown,
  right: unknown,
  path = '',
): JsonDiffEntry[] {
  if (Object.is(left, right)) return [];

  if (isRecord(left) && isRecord(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const entries: JsonDiffEntry[] = [];
    for (const key of [...keys].sort()) {
      const childPath = path ? `${path}.${key}` : key;
      entries.push(...diffJson(left[key], right[key], childPath));
    }
    return entries;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (JSON.stringify(left) === JSON.stringify(right)) return [];
    return [{ path: path || '/', left, right }];
  }

  return [{ path: path || '/', left, right }];
}
