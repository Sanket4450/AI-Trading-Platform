const API_BASE = process.env.API_URL ?? 'http://localhost:8000/api/v1';

/**
 * Builds the upstream URL for a proxied API path. Returns null for anything that could escape
 * the configured API base, so the proxy can only address real API routes.
 */
export function upstreamUrl(segments: string[], search = ''): string | null {
  if (segments.length === 0) return null;

  const safe = segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..' &&
      !segment.includes('/') &&
      !segment.includes('\\'),
  );
  if (!safe) return null;

  return `${API_BASE}/${segments.map(encodeURIComponent).join('/')}${search}`;
}
