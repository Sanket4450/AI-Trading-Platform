import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'ai_trading_session';

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  // The API is unreachable here, so this page must render without a session check.
  if (pathname === '/service-unavailable') {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    if (token) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!token) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

// API route handlers authenticate themselves; this guard only protects rendered routes.
export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
};
