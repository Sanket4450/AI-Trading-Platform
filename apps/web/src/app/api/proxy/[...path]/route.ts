import { NextResponse, type NextRequest } from 'next/server';
import { upstreamUrl } from '@/lib/api-proxy-target';

const SESSION_COOKIE = 'ai_trading_session';

/**
 * BFF proxy for browser-initiated API calls. The session token stays in the HttpOnly cookie and
 * is attached here, so the browser only ever sees `/api/proxy/...` requests.
 */
async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const { search } = new URL(request.url);
  const target = upstreamUrl(path, search);
  if (!target) {
    return NextResponse.json({ message: 'Invalid API path' }, { status: 400 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  const headers = new Headers({ accept: 'application/json', authorization: `Bearer ${token}` });
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json({ message: 'The API is unreachable.' }, { status: 502 });
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await upstream.arrayBuffer();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
