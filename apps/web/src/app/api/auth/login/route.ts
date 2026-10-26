import { NextResponse } from 'next/server';

const API_BASE = process.env.API_URL ?? 'http://localhost:8000/api/v1';
const SESSION_COOKIE = 'ai_trading_session';
const LOGIN_TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach the sign-in service. Please try again in a moment.' },
      { status: 503 },
    );
  }

  const payload = (await upstream.json().catch(() => ({}))) as {
    message?: string;
    token?: string;
    expiresAt?: string;
    user?: unknown;
  };

  if (!upstream.ok) {
    return NextResponse.json(
      { message: payload.message ?? 'Sign-in failed.' },
      { status: upstream.status },
    );
  }

  if (!payload.token) {
    return NextResponse.json(
      { message: 'Sign-in could not be completed. Please try again.' },
      { status: 502 },
    );
  }

  const expiresAt = payload.expiresAt
    ? new Date(payload.expiresAt).getTime()
    : Date.now() + 12 * 3600_000;
  const maxAge = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));

  const response = NextResponse.json({ user: payload.user });
  response.cookies.set(SESSION_COOKIE, payload.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  return response;
}
