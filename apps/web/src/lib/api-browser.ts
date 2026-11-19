'use client';

import { ApiError, UnauthorizedError } from './api-error';

const PROXY_BASE = '/api/proxy';
const AUTH_BASE = '/api/auth';
const SESSION_EXPIRED_PATH = '/api/auth/session-expired';

export interface ApiRequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Single browser entry point: JSON in, JSON out, one error contract. `onUnauthorized` only runs
 * for proxied API calls, because a 401 from the sign-in route means bad credentials.
 */
async function request<T>(
  url: string,
  init: ApiRequestInit,
  onUnauthorized?: () => void,
): Promise<T> {
  const headers = new Headers({ accept: 'application/json' });
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body,
    cache: 'no-store',
    credentials: 'same-origin',
    signal: init.signal,
  });

  if (response.status === 401) {
    const text = await response.text();
    onUnauthorized?.();
    throw new UnauthorizedError(text);
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

function expireSession(): void {
  window.location.assign(SESSION_EXPIRED_PATH);
}

/** Calls the Nest API through the BFF proxy so the session token stays HttpOnly. */
export function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  return request<T>(`${PROXY_BASE}${path}`, init, expireSession);
}

export function authLogin(email: string, password: string): Promise<{ user?: unknown }> {
  return request<{ user?: unknown }>(`${AUTH_BASE}/login`, {
    method: 'POST',
    body: { email, password },
  });
}

export function authLogout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`${AUTH_BASE}/logout`, { method: 'POST' });
}
