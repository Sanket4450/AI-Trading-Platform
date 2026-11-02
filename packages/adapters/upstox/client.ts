import { gunzipSync } from 'node:zlib';

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

  constructor(options: UpstoxClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://api.upstox.com').replace(/\/$/, '');
    this.instrumentsUrl =
      options.instrumentsUrl ??
      'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.networkEnabled = options.networkEnabled ?? true;
    this.timeoutMs = options.timeoutMs ?? 60_000;
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
    const response = await fetch(this.instrumentsUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw this.apiError('Instrument master request failed', response, await response.text());
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
    const json = isGzip ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error('Instrument master payload is not an array');
    }
    return parsed as UpstoxInstrument[];
  }

  async fetchHistoricalCandles(values: CandleRequest): Promise<UpstoxCandleResponse> {
    this.assertConfigured();
    const unit = values.unit ?? 'minutes';
    const interval = values.interval ?? 1;
    const key = encodeURIComponent(values.instrumentKey);
    const url = `${this.baseUrl}/v3/historical-candle/${key}/${unit}/${interval}/${values.to}/${values.from}`;
    return this.requestCandles(url, values.timeoutMs);
  }

  async fetchDailyCandles(
    values: Omit<CandleRequest, 'unit' | 'interval'>,
  ): Promise<UpstoxCandleResponse> {
    return this.fetchHistoricalCandles({ ...values, unit: 'days', interval: 1 });
  }

  async fetchIntradayCandles(values: {
    instrumentKey: string;
    unit?: 'minutes' | 'hours';
    interval?: number;
    timeoutMs?: number;
  }): Promise<UpstoxCandleResponse> {
    this.assertConfigured();
    const unit = values.unit ?? 'minutes';
    const interval = values.interval ?? 1;
    const key = encodeURIComponent(values.instrumentKey);
    const url = `${this.baseUrl}/v3/historical-candle/intraday/${key}/${unit}/${interval}`;
    return this.requestCandles(url, values.timeoutMs);
  }

  async fetchMarketHolidays(): Promise<UpstoxHoliday[]> {
    this.assertConfigured();
    const response = await this.request(`${this.baseUrl}/v2/market/holidays`);
    const parsed = (await response.json()) as { status?: string; data?: UpstoxHoliday[] };
    if (parsed.status !== 'success' || !Array.isArray(parsed.data)) {
      throw new Error('Market holidays response is not the documented contract');
    }
    return parsed.data;
  }

  async fetchMarketTimings(date: string): Promise<UpstoxMarketTiming[]> {
    this.assertConfigured();
    const response = await this.request(`${this.baseUrl}/v2/market/timings/${date}`);
    const parsed = (await response.json()) as { status?: string; data?: UpstoxMarketTiming[] };
    if (parsed.status !== 'success' || !Array.isArray(parsed.data)) {
      throw new Error('Market timings response is not the documented contract');
    }
    return parsed.data;
  }

  private async requestCandles(url: string, timeoutMs?: number): Promise<UpstoxCandleResponse> {
    const response = await this.request(url, timeoutMs);
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

  private async request(url: string, timeoutMs?: number): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
      },
      signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
    });
    if (!response.ok) {
      throw this.apiError('Upstox request failed', response, await response.text());
    }
    return response;
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
