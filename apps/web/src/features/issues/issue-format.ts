import type { SystemIssue } from '@/lib/types';

/** Fields every issue surface carries; the dialog reads the canonical row by id. */
export type IssuePreview = Pick<SystemIssue, 'id' | 'source' | 'kind' | 'severity' | 'symbol'>;

/** Compact row shape returned by the overview and instrument detail endpoints. */
export type IssueSummaryRow = IssuePreview &
  Pick<SystemIssue, 'lastSeenAt' | 'payload'> & {
    occurrenceCount?: number;
  };

/** Trims a full row to what the dialog needs, keeping large payloads off the client until open. */
export function issuePreview(issue: IssuePreview): IssuePreview {
  return {
    id: issue.id,
    source: issue.source,
    kind: issue.kind,
    severity: issue.severity,
    symbol: issue.symbol,
  };
}

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
  if (typeof tradingDate === 'string') return tradingDate;
  const from = payload.from;
  const to = payload.to;
  if (typeof from === 'string' && typeof to === 'string') {
    return `${from} → ${to}`;
  }
  return null;
}

export function issueError(payload: Record<string, unknown>): string | null {
  if (typeof payload.error === 'string' && payload.error.length > 0) {
    return payload.error;
  }
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
