/**
 * One pagination contract for the API, database layer and web app. Every list surface reads these
 * values, so a page size or cursor version can never drift between the server and the browser.
 */
export const PAGINATION_DEFAULT_LIMIT = 50;

/** Hard ceiling the API applies to every list request. */
export const PAGINATION_MAX_LIMIT = 200;

/** Sizes offered by the web page-size control. */
export const PAGINATION_LIMIT_OPTIONS = [25, 50, 100] as const;

export const PAGINATION_CURSOR_VERSION = 1;

export const PAGINATION_MAX_CURSOR_LENGTH = 1024;

export type PaginationMode = 'cursor' | 'offset';

/**
 * Response metadata shared by every paginated endpoint.
 *
 * - `mode=cursor`: `nextCursor` moves to older rows, `prevCursor` to newer rows.
 * - `mode=offset`: `offset` is the current window start; cursors are `null`.
 * - `total` is always the exact count for the request's filters.
 */
export interface PaginationMeta {
  mode: PaginationMode;
  limit: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  offset: number | null;
}

/** Envelope every paginated list endpoint returns. */
export interface Paginated<T> {
  items: T[];
  page: PaginationMeta;
}
