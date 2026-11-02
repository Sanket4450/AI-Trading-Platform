import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InMemoryRateLimiter,
  UpstoxApiError,
  UpstoxClient,
  classifyUpstoxError,
  parseCandleEnvelope,
} from '../index.js';
import {
  error401Fixture,
  error404Fixture,
  error429Fixture,
  error500Fixture,
  historicalNormalFixture,
  historicalUnsortedFixture,
  holidaysFixture,
  instrumentMasterFixture,
  intradayPartialFixture,
  timingsNormalFixture,
} from './fixtures.js';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let handler: Handler;

beforeAll(async () => {
  server = createServer((request, response) => handler(request, response));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

function client(): UpstoxClient {
  return new UpstoxClient({
    baseUrl,
    instrumentsUrl: `${baseUrl}/instruments/NSE.json.gz`,
    apiKey: 'key',
    accessToken: 'token',
    timeoutMs: 1000,
  });
}

function json(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}

describe('Upstox read-only client', () => {
  it('has no order, modify or cancel method', () => {
    const value = client() as unknown as Record<string, unknown>;
    expect(value.placeOrder).toBeUndefined();
    expect(value.modifyOrder).toBeUndefined();
    expect(value.cancelOrder).toBeUndefined();
  });

  it('reads a gzipped instrument master', async () => {
    handler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip' });
      response.end(gzipSync(JSON.stringify(instrumentMasterFixture)));
    };
    const master = await client().fetchInstrumentMaster();
    expect(master).toHaveLength(instrumentMasterFixture.length);
    expect(master[0]?.instrument_key).toBe('NSE_EQ|INE002A01018');
  });

  it('builds the documented historical V3 path and parses candles', async () => {
    let path = '';
    handler = (request, response) => {
      path = request.url ?? '';
      json(response, 200, historicalNormalFixture);
    };
    const candles = await client().fetchHistoricalCandles({
      instrumentKey: 'NSE_EQ|INE002A01018',
      from: '2026-09-01',
      to: '2026-09-30',
      unit: 'minutes',
      interval: 1,
    });
    expect(path).toBe(
      '/v3/historical-candle/NSE_EQ%7CINE002A01018/minutes/1/2026-09-30/2026-09-01',
    );
    expect(candles.data.candles).toHaveLength(3);
  });

  it('uses the days endpoint for the daily oracle', async () => {
    let path = '';
    handler = (request, response) => {
      path = request.url ?? '';
      json(response, 200, historicalNormalFixture);
    };
    await client().fetchDailyCandles({
      instrumentKey: 'NSE_EQ|INE002A01018',
      from: '2022-01-01',
      to: '2026-10-23',
    });
    expect(path).toContain('/days/1/2026-10-23/2022-01-01');
  });

  it('uses the intraday endpoint and keeps the partial final bar', async () => {
    let path = '';
    handler = (request, response) => {
      path = request.url ?? '';
      json(response, 200, intradayPartialFixture);
    };
    const response = await client().fetchIntradayCandles({
      instrumentKey: 'NSE_EQ|INE002A01018',
    });
    expect(path).toContain('/v3/historical-candle/intraday/');
    expect(response.data.candles.at(-1)?.[0]).toContain('15:29');
  });

  it('reads holidays and timings', async () => {
    handler = (request, response) => {
      if ((request.url ?? '').includes('/holidays'))
        json(response, 200, { status: 'success', data: holidaysFixture });
      else json(response, 200, { status: 'success', data: timingsNormalFixture });
    };
    const holidays = await client().fetchMarketHolidays();
    expect(holidays[0]?.date).toBe('2026-01-26');
    const timings = await client().fetchMarketTimings('2026-10-23');
    expect(timings[0]?.exchange).toBe('NSE');
  });

  it('classifies 401, 404, 429 and 500', async () => {
    const cases: [number, unknown, string, boolean][] = [
      [401, error401Fixture, 'auth', false],
      [404, error404Fixture, 'reference', false],
      [429, error429Fixture, 'throttle', true],
      [500, error500Fixture, 'transient', true],
    ];
    for (const [status, body, kind, retryable] of cases) {
      handler = (_request, response) => json(response, status, body);
      const error = await client()
        .fetchHistoricalCandles({
          instrumentKey: 'NSE_EQ|INE002A01018',
          from: '2026-09-01',
          to: '2026-09-30',
        })
        .then(
          () => null,
          (caught: unknown) => caught,
        );
      expect(error).toBeInstanceOf(UpstoxApiError);
      const classification = classifyUpstoxError(error);
      expect(classification.kind).toBe(kind);
      expect(classification.retryable).toBe(retryable);
    }
  });

  it('honours Retry-After on 429', async () => {
    handler = (_request, response) => json(response, 429, error429Fixture, { 'retry-after': '17' });
    const error = await client()
      .fetchHistoricalCandles({
        instrumentKey: 'NSE_EQ|INE002A01018',
        from: '2026-09-01',
        to: '2026-09-30',
      })
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(classifyUpstoxError(error).retryAfterSeconds).toBe(17);
  });

  it('rejects a malformed candle envelope', async () => {
    handler = (_request, response) => json(response, 200, { status: 'error', data: null });
    await expect(
      client().fetchHistoricalCandles({
        instrumentKey: 'NSE_EQ|INE002A01018',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ).rejects.toThrow(/documented contract/);
  });

  it('sorts unsorted candles only after parsing', () => {
    const envelope = parseCandleEnvelope(historicalUnsortedFixture);
    expect(envelope.data.candles[0]?.[0]).toContain('09:17');
  });
});

describe('rate limiter', () => {
  it('enforces the second window', async () => {
    const limiter = new InMemoryRateLimiter({ perSecond: 2, perMinute: 100, per30Minutes: 100 });
    const started = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    const state = await limiter.state();
    expect(state.availableSecond).toBeGreaterThanOrEqual(0);
  });

  it('pauses globally', async () => {
    const limiter = new InMemoryRateLimiter({ perSecond: 100, perMinute: 100, per30Minutes: 100 });
    await limiter.pause(120);
    const started = Date.now();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThanOrEqual(100);
  });
});
