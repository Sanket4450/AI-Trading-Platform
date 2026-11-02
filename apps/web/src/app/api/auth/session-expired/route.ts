import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'ai_trading_session';

/**
 * Clears an unusable session cookie before handing the browser to the sign-in page.
 * Without this, `proxy.ts` bounces `/login` back to `/` for any cookie, even a dead one.
 */
export function GET(request: Request) {
  const reason = new URL(request.url).searchParams.get('reason');
  const login = new URL('/login', request.url);
  login.searchParams.set('error', reason === 'api' ? 'api' : 'session');

  const response = NextResponse.redirect(login);
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
