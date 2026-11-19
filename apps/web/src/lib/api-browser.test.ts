import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, authLogin } from './api-browser';
import { ApiError, UnauthorizedError } from './api-error';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('POSTs JSON through the BFF proxy and returns the parsed body', async () => {
    const fetchMock = stubFetch(jsonResponse({ id: 'v1' }));

    const result = await apiRequest<{ id: string }>('/strategies/abc/versions', {
      method: 'POST',
      body: { codeRef: 'main@1' },
    });

    expect(result).toEqual({ id: 'v1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/proxy/strategies/abc/versions');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"codeRef":"main@1"}');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(init?.credentials).toBe('same-origin');
  });

  it('returns undefined for a 204 response', async () => {
    stubFetch(new Response(null, { status: 204 }));

    await expect(apiRequest('/settings/key', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws ApiError carrying the API message', async () => {
    stubFetch(jsonResponse({ message: 'Coverage already complete' }, 422));

    const request = apiRequest('/instruments/a/fetch', { method: 'POST' });

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 422,
      body: '{"message":"Coverage already complete"}',
    });
  });

  it('marks a proxied 401 as UnauthorizedError', async () => {
    stubFetch(jsonResponse({ message: 'Authentication required' }, 401));

    await expect(apiRequest('/accounts')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('does not treat a 401 from the sign-in route as an expired session', async () => {
    stubFetch(jsonResponse({ message: 'Invalid email or password' }, 401));

    const request = authLogin('ops@example.com', 'wrong-pass');

    await expect(request).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(request).rejects.toMatchObject({ status: 401 });
  });
});
