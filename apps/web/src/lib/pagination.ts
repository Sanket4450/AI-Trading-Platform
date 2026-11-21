import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
} from '@ai-trading/domain';
import type { RouteSearchParams } from './navigation';

export function readLimit(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(parsed) || parsed < 1) return PAGINATION_DEFAULT_LIMIT;
  return Math.min(parsed, PAGINATION_MAX_LIMIT);
}

export function readOffset(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function readCursorValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

interface PaginationHrefInput {
  pathname: string;
  searchParams: RouteSearchParams;
  /** Param names owned by this paginator; they are cleared before the next state is applied. */
  names?: { offset?: string; after?: string; before?: string };
  changes: Record<string, string | number | null | undefined>;
}

/** Builds a URL that keeps every filter except the paginator's own state. */
export function paginationHref({
  pathname,
  searchParams,
  names = {},
  changes,
}: PaginationHrefInput): string {
  const offsetName = names.offset ?? 'offset';
  const afterName = names.after ?? 'after';
  const beforeName = names.before ?? 'before';
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === offsetName || key === afterName || key === beforeName) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry) query.append(key, entry);
    }
  }

  for (const [key, value] of Object.entries(changes)) {
    query.delete(key);
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }

  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
