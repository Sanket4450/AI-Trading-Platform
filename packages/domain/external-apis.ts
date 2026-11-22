/**
 * Outbound network catalogue.
 *
 * Configuration only: how to reach an operation and how to label its scope keys. Operator-facing
 * labels live in the web app so the API never ships presentation copy.
 */

export const EXTERNAL_API_SERVICES = ['upstox', 'upstox-assets'] as const;

export type ExternalApiService = (typeof EXTERNAL_API_SERVICES)[number];

/** Buckets a call's parameters fall into. Every recorded scope carries all three. */
export type ExternalApiScopePart = 'path' | 'query' | 'body';

export const EXTERNAL_API_SCOPE_PARTS: ExternalApiScopePart[] = ['path', 'query', 'body'];

export interface ExternalApiOperationDefinition {
  method: string;
  /** Path template. `:name` placeholders are filled from `requestScope.path`. */
  endpoint: string;
  /** Environment variable holding this service's base URL. */
  baseUrlEnv: string;
  /** Scope buckets this operation fills; the rest are recorded empty. */
  partitions: readonly ExternalApiScopePart[];
  /** Body keys that must never be persisted. */
  redact?: readonly string[];
}

export const EXTERNAL_APIS = {
  upstox: {
    'historical-candle': {
      method: 'GET',
      endpoint: '/v3/historical-candle/:instrumentKey/:unit/:interval/:to/:from',
      baseUrlEnv: 'UPSTOX_BASE_URL',
      partitions: ['path'],
    },
    'intraday-candle': {
      method: 'GET',
      endpoint: '/v3/historical-candle/intraday/:instrumentKey/:unit/:interval',
      baseUrlEnv: 'UPSTOX_BASE_URL',
      partitions: ['path'],
    },
    'market-holidays': {
      method: 'GET',
      endpoint: '/v2/market/holidays',
      baseUrlEnv: 'UPSTOX_BASE_URL',
      partitions: [],
    },
    'market-timings': {
      method: 'GET',
      endpoint: '/v2/market/timings/:date',
      baseUrlEnv: 'UPSTOX_BASE_URL',
      partitions: ['path'],
    },
  },
  'upstox-assets': {
    'instrument-master': {
      method: 'GET',
      endpoint: '/market-quote/instruments/exchange/NSE.json.gz',
      baseUrlEnv: 'UPSTOX_INSTRUMENTS_URL',
      partitions: [],
    },
  },
} as const satisfies Record<ExternalApiService, Record<string, ExternalApiOperationDefinition>>;

export type ExternalApiCatalog = typeof EXTERNAL_APIS;
export type ExternalApiOperation<S extends ExternalApiService> = keyof ExternalApiCatalog[S] & string;
export type AnyExternalApiOperation = {
  [S in ExternalApiService]: ExternalApiOperation<S>;
}[ExternalApiService];

/** Every HTTP call is classified before it is recorded; the UI and retry policy read this. */
export const EXTERNAL_API_OUTCOMES = [
  'success',
  'contract_error',
  'auth_error',
  'client_error',
  'throttled',
  'server_error',
  'timeout',
  'network_error',
  'unknown',
] as const;

export type ExternalApiOutcome = (typeof EXTERNAL_API_OUTCOMES)[number];

export function isExternalApiOutcome(value: unknown): value is ExternalApiOutcome {
  return typeof value === 'string' && (EXTERNAL_API_OUTCOMES as readonly string[]).includes(value);
}

export function isExternalApiService(value: string): value is ExternalApiService {
  return Object.hasOwn(EXTERNAL_APIS, value);
}

/** HTTP status plus the transport error class decide the outcome; nothing else is stored. */
export function classifyApiOutcome(status: number | null, error?: unknown): ExternalApiOutcome {
  if (status === null) {
    const name = error instanceof Error ? error.name : '';
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
    if (/fetch failed|socket|network|ECONN|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT/i.test(message)) {
      return 'network_error';
    }
    return 'unknown';
  }
  if (status >= 200 && status < 300) return 'success';
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 429) return 'throttled';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  return 'unknown';
}

/** Raw error payloads are capped here; the database rejects anything longer. */
export const EXTERNAL_API_ERROR_BODY_LIMIT = 8192;

export interface ExternalApiScope {
  path: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
}

export function emptyExternalApiScope(): ExternalApiScope {
  return { path: {}, query: {}, body: {} };
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined && item !== null)
    .map(([key, item]) => [key, String(item)] as const);
  return Object.fromEntries(entries);
}

function unknownRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Reads a stored scope without trusting its shape; always returns all three buckets. */
export function readExternalApiScope(value: unknown): ExternalApiScope {
  const source = unknownRecord(value);
  return {
    path: stringRecord(source.path),
    query: stringRecord(source.query),
    body: unknownRecord(source.body),
  };
}

export function apiOperationDefinition(
  service: string,
  operation: string,
): ExternalApiOperationDefinition | null {
  if (!isExternalApiService(service)) return null;
  const definitions: Record<string, ExternalApiOperationDefinition> = EXTERNAL_APIS[service];
  return definitions[operation] ?? null;
}

export function renderApiPath(endpoint: string, scope: ExternalApiScope): string {
  return endpoint.replace(/:([A-Za-z0-9_]+)/g, (match, key: string) => {
    const value = scope.path[key];
    return value === undefined ? match : encodeURIComponent(value);
  });
}

/** Rebuilds the concrete URL for display from the template and the stored values. */
export function renderApiUrl(
  endpoint: string,
  scope: ExternalApiScope,
  origin: string | null,
): string {
  const path = renderApiPath(endpoint, scope);
  const query = new URLSearchParams(scope.query).toString();
  return `${origin ?? ''}${path}${query ? `?${query}` : ''}`;
}

/** Drops body keys an operation marks secret, then freezes the shape every row shares. */
export function buildApiScope(input: {
  path?: Record<string, string | number | undefined>;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  redact?: readonly string[];
}): ExternalApiScope {
  const path = stringRecord(input.path ?? {});
  const query = stringRecord(input.query ?? {});
  const body = { ...input.body };
  for (const key of input.redact ?? []) delete body[key];
  return { path, query, body };
}
