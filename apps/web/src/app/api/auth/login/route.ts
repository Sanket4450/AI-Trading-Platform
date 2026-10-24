import { NextResponse } from 'next/server';

const API_BASE = process.env.API_URL ?? 'http://localhost:8000/api/v1';
const SESSION_COOKIE = 'ai_trading_session';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const upstream = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });

  const payload = (await upstream.json().catch(() => ({}))) as {
    message?: string;
    token?: string;
    expiresAt?: string;
    user?: unknown;
  };

  if (!upstream.ok || !payload.token) {
    return NextResponse.json(
      { message: payload.message ?? 'Login failed' },
      { status: upstream.status || 401 },
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
