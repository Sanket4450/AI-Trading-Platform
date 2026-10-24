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

export interface UpstoxClientOptions {
  baseUrl?: string;
  instrumentsUrl?: string;
  apiKey?: string;
  accessToken?: string;
  networkEnabled?: boolean;
}

export class UpstoxApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'UpstoxApiError';
  }
}

/**
 * Read-only Upstox client for R1.
 *
 * There is deliberately no order, modify or cancel method. R1 must not be able
 * to reach a write endpoint even if a worker is misconfigured.
 */
export class UpstoxClient {
  private readonly baseUrl: string;
  private readonly instrumentsUrl: string;
  private readonly apiKey: string | undefined;
  private readonly accessToken: string | undefined;
  private readonly networkEnabled: boolean;

  constructor(options: UpstoxClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://api.upstox.com';
    this.instrumentsUrl =
      options.instrumentsUrl ??
      'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.networkEnabled = options.networkEnabled ?? true;
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
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new UpstoxApiError(
        `Instrument master request failed with ${response.status}`,
        response.status,
        await response.text(),
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const isGzip =
      this.instrumentsUrl.endsWith('.gz') ||
      response.headers.get('content-encoding')?.includes('gzip') ||
      (buffer[0] === 0x1f && buffer[1] === 0x8b);
    const json = isGzip ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error('Instrument master payload is not an array');
    }
    return parsed as UpstoxInstrument[];
  }

  async fetchHistoricalCandles(values: {
    instrumentKey: string;
    from: string;
    to: string;
    unit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
    interval?: number;
  }): Promise<UpstoxCandleResponse> {
    this.assertConfigured();
    const unit = values.unit ?? 'minutes';
    const interval = values.interval ?? 1;
    const key = encodeURIComponent(values.instrumentKey);
    const url = `${this.baseUrl}/v3/historical-candle/${key}/${unit}/${interval}/${values.to}/${values.from}`;
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new UpstoxApiError(
        `Historical candle request failed with ${response.status}`,
        response.status,
        await response.text(),
      );
    }
    return (await response.json()) as UpstoxCandleResponse;
  }

  async fetchIntradayCandles(values: {
    instrumentKey: string;
    unit?: 'minutes' | 'hours';
    interval?: number;
  }): Promise<UpstoxCandleResponse> {
    this.assertConfigured();
    const unit = values.unit ?? 'minutes';
    const interval = values.interval ?? 1;
    const key = encodeURIComponent(values.instrumentKey);
    const url = `${this.baseUrl}/v3/historical-candle/intraday/${key}/${unit}/${interval}`;
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new UpstoxApiError(
        `Intraday candle request failed with ${response.status}`,
        response.status,
        await response.text(),
      );
    }
    return (await response.json()) as UpstoxCandleResponse;
  }

  private assertConfigured(): void {
    const reason = this.configurationReason();
    if (reason) {
      throw new Error(`Upstox is not configured: ${reason}`);
    }
  }
}
