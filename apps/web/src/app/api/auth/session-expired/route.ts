import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'ai_trading_session';

/**
 * Clears an unusable session cookie before handing the browser to the sign-in page.
 * Without this, `proxy.ts` bounces `/login` back to `/` for any cookie, even a dead one.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Legacy links used `?reason=api` for an unreachable API. Route those to the outage page
  // without clearing a session that may still be valid.
  if (searchParams.get('reason') === 'api') {
    return NextResponse.redirect(new URL('/service-unavailable', request.url));
  }

  const login = new URL('/login', request.url);
  login.searchParams.set('error', 'session');

  const response = NextResponse.redirect(login);
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
