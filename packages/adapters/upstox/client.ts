import { gunzipSync } from 'node:zlib';
import {
  EXTERNAL_API_ERROR_BODY_LIMIT,
  buildApiScope,
  classifyApiOutcome,
  type ExternalApiScope,
} from '@ai-trading/domain';
import type { ExternalApiCallContext, ExternalApiCallSink } from '../external-api.js';

export interface UpstoxInstrument {
  instrument_key: string;
  exchange_token?: string;
  trading_symbol?: string;
  name?: string;
  short_name?: string;
  isin?: string;
  exchange?: string;
  segment?: string;
  instrument_type?: string;
  lot_size?: number;
  tick_size?: number;
  freeze_quantity?: number;
  qty_multiplier?: number;
  security_type?: string;
  cas_eligible?: boolean;
}

export type UpstoxCandle = [
  timestamp: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  openInterest?: number,
];

export interface UpstoxCandleResponse {
  status: string;
  data: { candles: UpstoxCandle[] };
}

export interface UpstoxHoliday {
  date: string;
  description: string;
  holiday_type: string;
  closed_exchanges: string[];
  open_exchanges: {
    exchange: string;
    start_time: number;
    end_time: number;
  }[];
}

export interface UpstoxMarketTiming {
  exchange: string;
  start_time: number;
  end_time: number;
}

export interface UpstoxErrorDetail {
  error_code?: string;
  message?: string;
  property_path?: string;
  invalid_value?: string;
}

export interface UpstoxErrorEnvelope {
  status: 'error';
  errors: UpstoxErrorDetail[];
}

export interface UpstoxClientOptions {
  baseUrl?: string;
  instrumentsUrl?: string;
  apiKey?: string;
  accessToken?: string;
  networkEnabled?: boolean;
  timeoutMs?: number;
  /** Receives one record per attempt; the recorder owns batching and persistence. */
  sink?: ExternalApiCallSink;
  context?: ExternalApiCallContext;
}

export class UpstoxApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
    readonly errorCode: string | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'UpstoxApiError';
  }
}

export type UpstoxErrorClass =
  | 'success'
  | 'contract'
  | 'request'
  | 'auth'
  | 'permission'
  | 'reference'
  | 'throttle'
  | 'transient';

export interface UpstoxErrorClassification {
  kind: UpstoxErrorClass;
  retryable: boolean;
  errorCode: string | null;
  retryAfterSeconds: number | null;
  message: string;
}

export function parseUpstoxErrorEnvelope(body: string): UpstoxErrorEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { status?: unknown }).status === 'error' &&
      Array.isArray((parsed as { errors?: unknown }).errors)
    ) {
      return parsed as UpstoxErrorEnvelope;
    }
  } catch {
    // A non-JSON error body is classified by HTTP status only.
  }
  return null;
}

export function classifyUpstoxError(error: unknown): UpstoxErrorClassification {
  if (error instanceof UpstoxApiError) {
    const envelope = parseUpstoxErrorEnvelope(error.body);
    const errorCode = error.errorCode ?? envelope?.errors[0]?.error_code ?? null;
    const message = envelope?.errors[0]?.message ?? error.message;
    if (error.status === 400) {
      return { kind: 'request', retryable: false, errorCode, retryAfterSeconds: null, message };
    }
    if (error.status === 401) {
      return { kind: 'auth', retryable: false, errorCode, retryAfterSeconds: null, message };
    }
    if (error.status === 403) {
      return { kind: 'permission', retryable: false, errorCode, retryAfterSeconds: null, message };
    }
    if (error.status === 404) {
      return { kind: 'reference', retryable: false, errorCode, retryAfterSeconds: null, message };
    }
    if (error.status === 429) {
      return {
        kind: 'throttle',
        retryable: true,
        errorCode,
        retryAfterSeconds: error.retryAfterSeconds,
        message,
      };
    }
    if (error.status >= 500) {
      return { kind: 'transient', retryable: true, errorCode, retryAfterSeconds: null, message };
    }
    return { kind: 'contract', retryable: false, errorCode, retryAfterSeconds: null, message };
  }

  if (error instanceof Error) {
    const transient =
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      /fetch failed|socket|network|ECONN|ENOTFOUND|EAI_AGAIN/i.test(error.message);
    return {
      kind: transient ? 'transient' : 'contract',
      retryable: transient,
      errorCode: null,
      retryAfterSeconds: null,
      message: error.message,
    };
  }

  return {
    kind: 'contract',
    retryable: false,
    errorCode: null,
    retryAfterSeconds: null,
    message: 'Unknown Upstox failure',
  };
}

export interface CandleRequest {
  instrumentKey: string;
  from: string;
  to: string;
  unit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  interval?: number;
  timeoutMs?: number;
  /** Resolved instrument, recorded with the call when the caller knows it. */
  instrumentId?: string | null;
}

/**
 * Read-only Upstox client for R1/R2.
 *
 * There is deliberately no order, modify or cancel method. The API has no
 * order route and the worker has no execution processor, so even a
 * misconfiguration cannot reach a broker write endpoint.
 */
export class UpstoxClient {
  private readonly baseUrl: string;
  private readonly instrumentsUrl: string;
  private readonly apiKey: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly networkEnabled: boolean;
  private readonly timeoutMs: number;
  private readonly sink: ExternalApiCallSink | undefined;
  private readonly context: ExternalApiCallContext;

  constructor(options: UpstoxClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://api.upstox.com').replace(/\/$/, '');
    this.instrumentsUrl =
      options.instrumentsUrl ??
      'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.networkEnabled = options.networkEnabled ?? true;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.sink = options.sink;
    this.context = options.context ?? {};
  }

  isConfigured(): boolean {
    return this.networkEnabled && Boolean(this.apiKey) && Boolean(this.accessToken);
  }

  configurationReason(): string | null {
    if (!this.networkEnabled) return 'UPSTOX_NETWORK_ENABLED is false';
    if (!this.apiKey) return 'UPSTOX_API_KEY is not set';
    if (!this.accessToken) return 'UPSTOX_ACCESS_TOKEN is not set';
    return null;
  }

  async fetchInstrumentMaster(): Promise<UpstoxInstrument[]> {
    this.assertConfigured();
    return this.tracedCall({
      service: 'upstox-assets',
      operation: 'instrument-master',
      scope: buildApiScope({}),
      errorPrefix: 'Instrument master request failed',
      execute: () =>
        fetch(this.instrumentsUrl, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        }),
      read: async (response) => {
        const buffer = Buffer.from(await response.arrayBuffer());
        const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
        const json = isGzip ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
        const parsed: unknown = JSON.parse(json);
        if (!Array.isArray(parsed)) {
          throw new Error('Instrument master payload is not an array');
        }
        return parsed as UpstoxInstrument[];
      },
    });
  }

  async fetchHistoricalCandles(values: CandleRequest): Promise<UpstoxCandleResponse> {
    this.assertConfigured();
    const unit = values.unit ?? 'minutes';
    const interval = values.interval ?? 1;
    const key = encodeURIComponent(values.instrumentKey);
    const url = `${this.baseUrl}/v3/historical-candle/${key}/${unit}/${interval}/${values.to}/${values.from}`;
    return this.tracedCall({
      service: 'upstox',
      operation: 'historical-candle',
      instrumentId: values.instrumentId,
      scope: buildApiScope({
        path: {
          instrumentKey: values.instrumentKey,
          unit,
          interval,
          to: values.to,
          from: values.from,
        },
      }),
      errorPrefix: 'Upstox request failed',
      execute: () => this.request(url, values.timeoutMs),
      read: (response) => this.readCandles(response),
    });
  }

  async fetchIntradayCandles(values: {
    instrumentKey: string;
    unit?: 'minutes' | 'hours';
    interval?: number;
    timeoutMs?: number;
    instrumentId?: string | null;
  }): Promise<UpstoxCandleResponse> {
    this.assertConfigured();
    const unit = values.unit ?? 'minutes';
    const interval = values.interval ?? 1;
    const key = encodeURIComponent(values.instrumentKey);
    const url = `${this.baseUrl}/v3/historical-candle/intraday/${key}/${unit}/${interval}`;
    return this.tracedCall({
      service: 'upstox',
      operation: 'intraday-candle',
      instrumentId: values.instrumentId,
      scope: buildApiScope({
        path: { instrumentKey: values.instrumentKey, unit, interval },
      }),
      errorPrefix: 'Upstox request failed',
      execute: () => this.request(url, values.timeoutMs),
      read: (response) => this.readCandles(response),
    });
  }

  async fetchMarketHolidays(): Promise<UpstoxHoliday[]> {
    this.assertConfigured();
    const url = `${this.baseUrl}/v2/market/holidays`;
    return this.tracedCall({
      service: 'upstox',
      operation: 'market-holidays',
      scope: buildApiScope({}),
      errorPrefix: 'Upstox request failed',
      execute: () => this.request(url),
      read: async (response) => {
        const parsed = (await response.json()) as { status?: string; data?: UpstoxHoliday[] };
        if (parsed.status !== 'success' || !Array.isArray(parsed.data)) {
          throw new Error('Market holidays response is not the documented contract');
        }
        return parsed.data;
      },
    });
  }

  async fetchMarketTimings(date: string): Promise<UpstoxMarketTiming[]> {
    this.assertConfigured();
    const url = `${this.baseUrl}/v2/market/timings/${encodeURIComponent(date)}`;
    return this.tracedCall({
      service: 'upstox',
      operation: 'market-timings',
      scope: buildApiScope({ path: { date } }),
      errorPrefix: 'Upstox request failed',
      execute: () => this.request(url),
      read: async (response) => {
        const parsed = (await response.json()) as {
          status?: string;
          data?: UpstoxMarketTiming[];
        };
        if (parsed.status !== 'success' || !Array.isArray(parsed.data)) {
          throw new Error('Market timings response is not the documented contract');
        }
        return parsed.data;
      },
    });
  }

  private async readCandles(response: Response): Promise<UpstoxCandleResponse> {
    const parsed = (await response.json()) as UpstoxCandleResponse;
    if (
      !parsed ||
      parsed.status !== 'success' ||
      !parsed.data ||
      !Array.isArray(parsed.data.candles)
    ) {
      throw new Error('Candle response is not the documented contract');
    }
    return parsed;
  }

  /**
   * Single exit point for every request. Latency covers the network exchange only; the sink is
   * called exactly once per attempt and can never change the result of the call.
   */
  private async tracedCall<T>(input: {
    service: string;
    operation: string;
    scope: ExternalApiScope;
    instrumentId?: string | null;
    errorPrefix: string;
    execute: () => Promise<Response>;
    read: (response: Response) => Promise<T>;
  }): Promise<T> {
    const startedAt = new Date();
    const startedMs = Date.now();
    let statusCode: number | null = null;

    try {
      const response = await input.execute();
      statusCode = response.status;
      const latencyMs = Math.max(0, Date.now() - startedMs);

      if (!response.ok) {
        const body = await response.text();
        this.record(input, {
          startedAt,
          latencyMs,
          statusCode: response.status,
          outcome: classifyApiOutcome(response.status),
          errorBody: truncate(body),
        });
        throw this.apiError(input.errorPrefix, response, body);
      }

      try {
        const value = await input.read(response);
        this.record(input, {
          startedAt,
          latencyMs,
          statusCode: response.status,
          outcome: 'success',
          errorBody: null,
        });
        return value;
      } catch (error) {
        this.record(input, {
          startedAt,
          latencyMs,
          statusCode: response.status,
          outcome: 'contract_error',
          errorBody: truncate(error instanceof Error ? error.message : String(error)),
        });
        throw error;
      }
    } catch (error) {
      if (statusCode !== null) throw error;
      this.record(input, {
        startedAt,
        latencyMs: Math.max(0, Date.now() - startedMs),
        statusCode: null,
        outcome: classifyApiOutcome(null, error),
        errorBody: truncate(error instanceof Error ? error.message : String(error)),
      });
      throw error;
    }
  }

  private record(
    input: { service: string; operation: string; scope: ExternalApiScope; instrumentId?: string | null },
    result: {
      startedAt: Date;
      latencyMs: number;
      statusCode: number | null;
      outcome: ReturnType<typeof classifyApiOutcome>;
      errorBody: string | null;
    },
  ): void {
    if (!this.sink) return;
    try {
      this.sink.record({
        jobRunId: this.context.jobRunId ?? null,
        service: input.service,
        operation: input.operation,
        instrumentId: input.instrumentId ?? this.context.instrumentId ?? null,
        startedAt: result.startedAt,
        latencyMs: result.latencyMs,
        statusCode: result.statusCode,
        outcome: result.outcome,
        requestScope: input.scope,
        errorBody: result.errorBody,
      });
    } catch {
      // Telemetry must never fail the request it describes.
    }
  }

  private async request(url: string, timeoutMs?: number): Promise<Response> {
    return fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
      },
      signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
    });
  }

  private apiError(prefix: string, response: Response, body: string): UpstoxApiError {
    const envelope = parseUpstoxErrorEnvelope(body);
    const errorCode = envelope?.errors[0]?.error_code ?? null;
    const retryAfter = response.headers.get('retry-after');
    const retryAfterSeconds =
      retryAfter && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) : null;
    return new UpstoxApiError(
      `${prefix} with ${response.status}`,
      response.status,
      body,
      errorCode,
      retryAfterSeconds,
    );
  }

  private assertConfigured(): void {
    const reason = this.configurationReason();
    if (reason) {
      throw new Error(`Upstox is not configured: ${reason}`);
    }
  }
}

/** Error bodies are capped before they reach the sink; the database enforces the same limit. */
function truncate(value: string): string {
  return value.length > EXTERNAL_API_ERROR_BODY_LIMIT
    ? value.slice(0, EXTERNAL_API_ERROR_BODY_LIMIT)
    : value;
}
