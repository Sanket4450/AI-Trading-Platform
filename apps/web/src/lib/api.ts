import { cookies } from 'next/headers';

const API_BASE = process.env.API_URL ?? 'http://localhost:8000/api/v1';
const SESSION_COOKIE = 'ai_trading_session';
const HEALTH_TIMEOUT_MS = 5_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(body: string) {
    super('Authentication required', 401, body);
    this.name = 'UnauthorizedError';
  }
}

/** Pulls the operator-facing message out of a Nest error body. */
function messageFromBody(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (Array.isArray(parsed.message)) {
      const lines = parsed.message.filter((line): line is string => typeof line === 'string');
      return lines.length > 0 ? lines.join('; ') : null;
    }
    return typeof parsed.message === 'string' && parsed.message ? parsed.message : null;
  } catch {
    return null;
  }
}

/**
 * Prefers the API's own explanation over the generic "API request failed: 400" text so
 * validation errors reach the operator instead of a bare status code.
 */
export function apiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (!(error instanceof Error)) return fallback;
  if (error instanceof ApiError) {
    return messageFromBody(error.body) ?? error.message;
  }
  return error.message;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (response.status === 401) {
    throw new UnauthorizedError(await response.text());
  }
  if (!response.ok) {
    throw new ApiError(
      `API request failed: ${response.status} ${response.statusText}`,
      response.status,
      await response.text(),
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function getSession() {
  return apiFetch<{ user: import('./types.js').SessionUser }>('/auth/session');
}

/** Reads the public health endpoint so pre-auth pages can show the active trading mode. */
export async function getPublicHealth(): Promise<import('./types.js').HealthResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as import('./types.js').HealthResponse;
  } catch {
    return null;
  }
}
