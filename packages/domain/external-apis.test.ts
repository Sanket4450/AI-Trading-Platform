import { describe, expect, it } from 'vitest';
import {
  EXTERNAL_APIS,
  EXTERNAL_API_OUTCOMES,
  EXTERNAL_API_SERVICES,
  apiOperationDefinition,
  buildApiScope,
  classifyApiOutcome,
  emptyExternalApiScope,
  readExternalApiScope,
  renderApiUrl,
} from './external-apis.js';

describe('external API catalogue', () => {
  it('resolves every declared service and operation', () => {
    for (const service of EXTERNAL_API_SERVICES) {
      for (const operation of Object.keys(EXTERNAL_APIS[service])) {
        const definition = apiOperationDefinition(service, operation);
        expect(definition?.method).toBeTruthy();
        expect(definition?.endpoint.startsWith('/')).toBe(true);
        expect(definition?.baseUrlEnv).toMatch(/^UPSTOX_/);
      }
    }
  });

  it('keeps the historical candle template in the wire order to-then-from', () => {
    expect(EXTERNAL_APIS.upstox['historical-candle'].endpoint).toBe(
      '/v3/historical-candle/:instrumentKey/:unit/:interval/:to/:from',
    );
  });

  it('ignores unknown services and operations', () => {
    expect(apiOperationDefinition('binance', 'historical-candle')).toBeNull();
    expect(apiOperationDefinition('upstox', 'place-order')).toBeNull();
  });
});

describe('external API scope', () => {
  it('always produces the same three buckets', () => {
    expect(emptyExternalApiScope()).toEqual({ path: {}, query: {}, body: {} });
    expect(buildApiScope({ path: { date: '2026-11-22' } })).toEqual({
      path: { date: '2026-11-22' },
      query: {},
      body: {},
    });
  });

  it('drops redacted body keys and stringifies scalar path values', () => {
    const scope = buildApiScope({
      path: { instrumentKey: 'NSE_EQ|INE002A01018', interval: 1 },
      body: { quantity: 10, accessToken: 'secret' },
      redact: ['accessToken'],
    });
    expect(scope.path).toEqual({ instrumentKey: 'NSE_EQ|INE002A01018', interval: '1' });
    expect(scope.body).toEqual({ quantity: 10 });
  });

  it('reads stored scope defensively', () => {
    expect(readExternalApiScope(null)).toEqual({ path: {}, query: {}, body: {} });
    expect(readExternalApiScope({ path: 'nope', query: { a: 1 } })).toEqual({
      path: {},
      query: { a: '1' },
      body: {},
    });
  });
});

describe('external API URL rendering', () => {
  it('fills placeholders, encodes values and appends the query', () => {
    const scope = buildApiScope({
      path: { instrumentKey: 'NSE_EQ|INE002A01018', unit: 'minutes', interval: 1 },
      query: { exchange: 'NSE' },
    });
    expect(
      renderApiUrl(
        '/v3/historical-candle/intraday/:instrumentKey/:unit/:interval',
        scope,
        'https://api.upstox.com',
      ),
    ).toBe(
      'https://api.upstox.com/v3/historical-candle/intraday/NSE_EQ%7CINE002A01018/minutes/1?exchange=NSE',
    );
  });

  it('leaves an unfilled placeholder visible instead of hiding the gap', () => {
    expect(renderApiUrl('/v2/market/timings/:date', emptyExternalApiScope(), null)).toBe(
      '/v2/market/timings/:date',
    );
  });
});

describe('external API outcome classification', () => {
  it('maps HTTP status classes', () => {
    expect(classifyApiOutcome(200)).toBe('success');
    expect(classifyApiOutcome(204)).toBe('success');
    expect(classifyApiOutcome(400)).toBe('client_error');
    expect(classifyApiOutcome(404)).toBe('client_error');
    expect(classifyApiOutcome(401)).toBe('auth_error');
    expect(classifyApiOutcome(403)).toBe('auth_error');
    expect(classifyApiOutcome(429)).toBe('throttled');
    expect(classifyApiOutcome(500)).toBe('server_error');
    expect(classifyApiOutcome(503)).toBe('server_error');
  });

  it('splits transport failures from unclassified ones', () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    expect(classifyApiOutcome(null, timeout)).toBe('timeout');
    expect(classifyApiOutcome(null, new Error('fetch failed'))).toBe('network_error');
    expect(classifyApiOutcome(null, new Error('boom'))).toBe('unknown');
  });

  it('only ever returns a stored outcome', () => {
    expect(EXTERNAL_API_OUTCOMES).toContain(classifyApiOutcome(418));
  });
});
