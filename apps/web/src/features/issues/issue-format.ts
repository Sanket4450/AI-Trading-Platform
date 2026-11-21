/** Reads the common, type-specific payload keys without assuming one shape. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function issueWindow(payload: Record<string, unknown>): string | null {
  const window = asRecord(payload.window);
  if (window && typeof window.from === 'string' && typeof window.to === 'string') {
    return `${window.from} → ${window.to}`;
  }
  const tradingDate = payload.tradingDate;
  return typeof tradingDate === 'string' ? tradingDate : null;
}

export function issueError(payload: Record<string, unknown>): string | null {
  const error = asRecord(payload.error);
  if (!error) return null;
  const parts = [error.kind, error.code, error.message].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
