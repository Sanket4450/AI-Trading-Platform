import type { Paginated } from '@ai-trading/domain';
import { makeCursor } from './cursor.js';

export function offsetPage<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
): Paginated<T> {
  return {
    items,
    page: {
      mode: 'offset',
      limit,
      total,
      hasMore: offset + items.length < total,
      nextCursor: null,
      prevCursor: null,
      offset,
    },
  };
}

interface CursorPageInput<T> {
  items: T[];
  total: number;
  limit: number;
  hasExtra: boolean;
  fingerprint: string;
  keyOf: (item: T) => string;
  idOf: (item: T) => string;
  /** True when the request supplied `after`; the first row then has a newer neighbour. */
  hadAfter: boolean;
}

/** Newest-first page: `nextCursor` walks older, `prevCursor` walks newer. */
export function forwardPage<T>(input: CursorPageInput<T>): Paginated<T> {
  const first = input.items[0];
  const last = input.items[input.items.length - 1];
  const nextCursor =
    input.hasExtra && last
      ? makeCursor(input.fingerprint, input.keyOf(last), input.idOf(last))
      : null;
  const prevCursor =
    input.hadAfter && first
      ? makeCursor(input.fingerprint, input.keyOf(first), input.idOf(first))
      : null;

  return {
    items: input.items,
    page: {
      mode: 'cursor',
      limit: input.limit,
      total: input.total,
      hasMore: nextCursor !== null,
      nextCursor,
      prevCursor,
      offset: null,
    },
  };
}

interface BackwardPageInput<T> {
  /** Rows already re-ordered newest first. */
  items: T[];
  total: number;
  limit: number;
  hasExtra: boolean;
  fingerprint: string;
  keyOf: (item: T) => string;
  idOf: (item: T) => string;
}

/**
 * Page loaded with `before`. The page it came from is always older, so `nextCursor` is valid;
 * `prevCursor` exists only when the query proved more newer rows exist.
 */
export function backwardPage<T>(input: BackwardPageInput<T>): Paginated<T> {
  const first = input.items[0];
  const last = input.items[input.items.length - 1];
  const nextCursor = last
    ? makeCursor(input.fingerprint, input.keyOf(last), input.idOf(last))
    : null;
  const prevCursor =
    input.hasExtra && first
      ? makeCursor(input.fingerprint, input.keyOf(first), input.idOf(first))
      : null;

  return {
    items: input.items,
    page: {
      mode: 'cursor',
      limit: input.limit,
      total: input.total,
      hasMore: nextCursor !== null,
      nextCursor,
      prevCursor,
      offset: null,
    },
  };
}

/** Chronological feed: only the older direction is paginated. */
export function olderPage<T>(input: {
  items: T[];
  total: number;
  limit: number;
  hasExtra: boolean;
  fingerprint: string;
  keyOf: (item: T) => string;
  idOf: (item: T) => string;
}): Paginated<T> {
  const first = input.items[0];
  const nextCursor =
    input.hasExtra && first
      ? makeCursor(input.fingerprint, input.keyOf(first), input.idOf(first))
      : null;

  return {
    items: input.items,
    page: {
      mode: 'cursor',
      limit: input.limit,
      total: input.total,
      hasMore: nextCursor !== null,
      nextCursor,
      prevCursor: null,
      offset: null,
    },
  };
}
