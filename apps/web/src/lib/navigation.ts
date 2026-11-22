import { routeMetaFor } from './route-meta';

export interface BackLink {
  href: string;
  label: string;
}

/** Repeated query keys arrive as arrays, so any reader must handle both shapes. */
export type RouteSearchParams = Record<string, string | string[] | undefined>;

/** Search params of a detail page: only the drill-down origin is expected. */
export type DetailSearchParams = Promise<{ from?: string | string[] }>;

/** Query key that carries the origin page of a drill-down. */
const FROM_PARAM = 'from';

/**
 * Routes a detail page may return to. Restricting the target to known list pages keeps a crafted
 * `from` from turning the back control into an open redirect.
 */
const ORIGIN_PATHS = new Set([
  '/',
  '/accounts',
  '/instruments',
  '/issues',
  '/strategies',
  '/jobs',
  '/api-calls',
  '/audit',
  '/settings',
]);

/** Serializes a page's resolved search params back into a query string. */
export function searchParamsToQuery(searchParams: RouteSearchParams = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === FROM_PARAM || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== '') query.append(key, entry);
    }
  }
  return query.toString();
}

/** URL of a list page together with the filter state it is currently showing. */
export function originHref(pathname: string, searchParams: RouteSearchParams = {}): string {
  const query = searchParamsToQuery(searchParams);
  return query ? `${pathname}?${query}` : pathname;
}

/** Detail-page link that remembers the origin page so it can restore its filters. */
export function detailHref(pathname: string, from: string): string {
  const separator = pathname.includes('?') ? '&' : '?';
  return `${pathname}${separator}${FROM_PARAM}=${encodeURIComponent(from)}`;
}

/** Accepts only in-app list URLs; anything else is ignored in favour of the page fallback. */
export function safeReturnPath(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/.test(value)) return null;

  const [pathname = ''] = value.split('?');
  return ORIGIN_PATHS.has(pathname) ? value : null;
}

/**
 * Back control for a detail page. `from` wins when it is a known origin; otherwise the page's own
 * list route is used so the control is always present.
 */
export function backLinkFor(from: string | string[] | undefined, fallbackPath: string): BackLink {
  const href = safeReturnPath(from) ?? fallbackPath;
  const [pathname = ''] = href.split('?');
  return { href, label: `Back to ${routeMetaFor(pathname).title.toLowerCase()}` };
}
