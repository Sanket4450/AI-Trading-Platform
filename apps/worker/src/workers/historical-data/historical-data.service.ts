import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UpstoxClient,
  type UpstoxCandle,
  type UpstoxInstrument,
} from '@ai-trading/adapters';
import { sha256Hex } from '@ai-trading/domain';
import type { InferInsertModel } from 'drizzle-orm';
import {
  computeCoverageForInstrument,
  createIngestionRun,
  createQualityIssue,
  createRawProviderPayload,
  ensureMarketPartitions,
  findExchangeByCode,
  findProviderByCode,
  findProviderMapping,
  getExpectedBarsForDate,
  getInstrumentExchangeCode,
  refreshDailyStats,
  syncTradingCalendarFixture,
  updateIngestionRun,
  updateJobRun,
  upsertCandles,
  upsertCoverage,
  upsertInstrumentMasterRows,
  schema,
  type InstrumentMasterRow,
} from '@ai-trading/database';

type CandleInsert = InferInsertModel<typeof schema.marketCandles1m>;

function istDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function monthChunks(from: string, to: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const chunkEnd = monthEnd > end ? end : monthEnd;
    chunks.push({
      from: cursor.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }
  return chunks;
}

function normalizeCandle(
  candle: UpstoxCandle,
  instrumentId: string,
  providerId: string,
  ingestionRunId: string,
  rawPayloadId: string,
): { row: CandleInsert; error?: never } | { row?: never; error: string } {
  const [timestamp, open, high, low, close, volume] = candle;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `Invalid candle timestamp ${timestamp}` };
  }
  const values = { open, high, low, close, volume };
  for (const [field, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) {
      return { error: `Candle ${timestamp} has invalid ${field}` };
    }
  }
  if (open <= 0 || low <= 0 || close <= 0) {
    return { error: `Candle ${timestamp} has a non-positive price` };
  }
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    return { error: `Candle ${timestamp} violates OHLC bounds` };
  }
  if (volume < 0) {
    return { error: `Candle ${timestamp} has negative volume` };
  }

  return {
    row: {
      instrumentId,
      candleStart: parsed,
      tradingDate: istDate(parsed),
      open: String(open),
      high: String(high),
      low: String(low),
      close: String(close),
      volume: String(volume),
      sourceProviderId: providerId,
      ingestionRunId,
      rawPayloadId,
      isFinal: true,
    },
  };
}

@Injectable()
export class HistoricalDataService {
  private readonly logger = new Logger(HistoricalDataService.name);

  constructor(private readonly config: ConfigService) {}

  private client(): UpstoxClient {
    return new UpstoxClient({
      instrumentsUrl: this.config.get<string>('UPSTOX_INSTRUMENTS_URL'),
      apiKey: this.config.get<string>('UPSTOX_API_KEY'),
      accessToken: this.config.get<string>('UPSTOX_ACCESS_TOKEN'),
      networkEnabled:
        this.config.get<boolean | string>('UPSTOX_NETWORK_ENABLED', true) ===
          true || this.config.get<string>('UPSTOX_NETWORK_ENABLED') === 'true',
    });
  }

  async run(jobName: string, payload: Record<string, unknown>) {
    switch (jobName) {
      case 'historical-backfill':
        return this.backfill(payload);
      case 'instrument-sync':
        return this.instrumentSync(payload);
      case 'calendar-sync':
        return this.calendarSync(payload);
      case 'coverage-recompute':
        return this.coverageRecompute(payload);
      default:
        throw new Error(`Unknown historical-data job: ${jobName}`);
    }
  }

  async backfill(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    const instrumentId = String(payload.instrumentId);
    const from = String(payload.from);
    const to = String(payload.to);
    const providerId = String(payload.providerId);

    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });

    const client = this.client();
    const reason = client.configurationReason();
    if (reason) {
      const result = { skipped: true, reason };
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      return result;
    }

    const provider = await findProviderByCode('upstox');
    if (!provider || provider.id !== providerId) {
      throw new Error('Upstox provider is not available');
    }
    const mapping = await findProviderMapping(instrumentId, providerId);
    if (!mapping) {
      throw new Error(`No Upstox mapping for instrument ${instrumentId}`);
    }

    const ingestion = await createIngestionRun({
      providerId,
      runType: 'historical_backfill',
      instrumentId,
      timeframeUnit: 'minutes',
      timeframeInterval: 1,
      requestedFrom: from,
      requestedTo: to,
      status: 'running',
    });
    await updateIngestionRun(ingestion.id, {
      status: 'running',
      startedAt: new Date(),
    });
    await ensureMarketPartitions(6);

    let rowsFetched = 0;
    let rowsWritten = 0;
    let rowsRejected = 0;

    try {
      for (const chunk of monthChunks(from, to)) {
        const response = await client.fetchHistoricalCandles({
          instrumentKey: mapping.externalKey,
          from: chunk.from,
          to: chunk.to,
          unit: 'minutes',
          interval: 1,
        });

        const serialized = JSON.stringify(response);
        const raw = await createRawProviderPayload({
          providerId,
          endpoint: '/v3/historical-candle/:instrument_key/minutes/1/:to/:from',
          httpMethod: 'GET',
          requestFingerprint: sha256Hex(
            `${mapping.externalKey}|${chunk.from}|${chunk.to}|minutes|1`,
          ),
          requestParams: {
            instrumentKey: mapping.externalKey,
            from: chunk.from,
            to: chunk.to,
            unit: 'minutes',
            interval: 1,
          },
          httpStatus: 200,
          contentEncoding: null,
          payload: response,
          payloadBytes: Buffer.byteLength(serialized, 'utf8'),
          payloadSha256: sha256Hex(serialized),
          retentionClass: 'standard',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

        const candles = response.data?.candles ?? [];
        rowsFetched += candles.length;
        const valid: CandleInsert[] = [];

        for (const candle of candles) {
          const normalized = normalizeCandle(
            candle,
            instrumentId,
            providerId,
            ingestion.id,
            raw.id,
          );
          if (!normalized.row) {
            rowsRejected += 1;
            await createQualityIssue({
              providerId,
              instrumentId,
              issueType: 'invalid_ohlc',
              severity: 'warning',
              tradingDate: null,
              windowStart: null,
              windowEnd: null,
              details: { message: normalized.error ?? 'Invalid candle', chunk },
              detectedBy: 'validation',
            });
          } else {
            valid.push(normalized.row);
          }
        }

        rowsWritten += await upsertCandles(valid);
      }

      await updateIngestionRun(ingestion.id, {
        status: rowsRejected > 0 ? 'partially_failed' : 'succeeded',
        rowsFetched,
        rowsWritten,
        rowsRejected,
        finishedAt: new Date(),
      });

      const coverage = await this.recomputeCoverage(instrumentId, from, to);
      await refreshDailyStats();

      const result = { rowsFetched, rowsWritten, rowsRejected, coverage };
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      return result;
    } catch (error) {
      await updateIngestionRun(ingestion.id, {
        status: 'failed',
        rowsFetched,
        rowsWritten,
        rowsRejected,
        errorMessage:
          error instanceof Error ? error.message : 'Backfill failed',
        finishedAt: new Date(),
      });
      await updateJobRun(jobRunId, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Backfill failed',
      });
      throw error;
    }
  }

  async instrumentSync(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });

    const client = this.client();
    const reason = client.configurationReason();
    if (reason) {
      const result = { skipped: true, reason };
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      return result;
    }

    const provider = await findProviderByCode('upstox');
    if (!provider) throw new Error('Upstox provider is not seeded');

    const master = await client.fetchInstrumentMaster();
    const serialized = JSON.stringify(master);
    await createRawProviderPayload({
      providerId: provider.id,
      endpoint: '/instruments/NSE.json.gz',
      httpMethod: 'GET',
      requestFingerprint: sha256Hex('instrument-master|NSE'),
      requestParams: { exchange: 'NSE' },
      httpStatus: 200,
      contentEncoding: 'gzip',
      payload: master,
      payloadBytes: Buffer.byteLength(serialized, 'utf8'),
      payloadSha256: sha256Hex(serialized),
      retentionClass: 'extended',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    const limit = this.config.get<number>('INSTRUMENT_SYNC_LIMIT', 5000);
    const rows: InstrumentMasterRow[] = master
      .filter((instrument: UpstoxInstrument) => {
        if (
          !instrument.instrument_key ||
          !instrument.trading_symbol ||
          !instrument.exchange
        ) {
          return false;
        }
        return (
          ['NSE', 'BSE'].includes(instrument.exchange) &&
          ['NSE_EQ', 'BSE_EQ', 'NSE_INDEX', 'BSE_INDEX'].includes(
            instrument.segment ?? '',
          )
        );
      })
      .slice(0, limit)
      .map((instrument) => {
        const segment = instrument.segment ?? 'NSE_EQ';
        const instrumentType =
          instrument.instrument_type ??
          (segment.endsWith('_INDEX') ? 'INDEX' : 'EQ');
        return {
          externalKey: instrument.instrument_key,
          exchangeCode: instrument.exchange ?? 'NSE',
          tradingSymbol: instrument.trading_symbol ?? '',
          name: instrument.name ?? instrument.trading_symbol ?? '',
          shortName: instrument.short_name ?? null,
          isin: instrument.isin ? instrument.isin.toUpperCase() : null,
          segment,
          instrumentType,
          lotSize: instrument.lot_size ?? 1,
          tickSize: String(instrument.tick_size ?? 0.05),
          freezeQuantity:
            instrument.freeze_quantity === undefined ||
            instrument.freeze_quantity === null
              ? null
              : String(instrument.freeze_quantity),
          exchangeToken: instrument.exchange_token ?? null,
          providerSymbol: instrument.trading_symbol ?? null,
          providerSegment: segment,
        } satisfies InstrumentMasterRow;
      });

    const result = await upsertInstrumentMasterRows(provider.id, rows);
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result: { ...result, fetched: master.length },
    });
    this.logger.log(`Instrument sync complete: ${JSON.stringify(result)}`);
    return result;
  }

  async calendarSync(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });

    const provider = await findProviderByCode('upstox');
    const exchange = await findExchangeByCode('NSE');
    if (!provider || !exchange) throw new Error('Reference data is not seeded');

    const year = new Date().getUTCFullYear();
    const rows = await syncTradingCalendarFixture(exchange.id, provider.id, [
      year,
      year + 1,
    ]);
    const result = { rows, years: [year, year + 1], source: 'nse-fixture' };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    return result;
  }

  async coverageRecompute(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    const instrumentId = String(payload.instrumentId);
    const from = String(payload.from);
    const to = String(payload.to);
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });

    const result = await this.recomputeCoverage(instrumentId, from, to);
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    return result;
  }

  private async recomputeCoverage(
    instrumentId: string,
    from: string,
    to: string,
  ) {
    const exchangeCode =
      (await getInstrumentExchangeCode(instrumentId)) ?? 'NSE';
    const rows = await computeCoverageForInstrument(instrumentId, from, to);
    const byDate = new Map(rows.map((row) => [row.tradingDate, row]));

    const dates: string[] = [];
    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    let complete = 0;
    let partial = 0;
    let missing = 0;

    for (const date of dates) {
      const expected = await getExpectedBarsForDate(exchangeCode, date);
      if (expected <= 0) continue;
      const row = byDate.get(date);
      const storedBars = row?.storedBars ?? 0;
      const gapCount = Math.max(0, expected - storedBars);
      const status =
        gapCount === 0 ? 'complete' : storedBars === 0 ? 'missing' : 'partial';
      if (status === 'complete') complete += 1;
      else if (status === 'partial') partial += 1;
      else missing += 1;

      await upsertCoverage({
        instrumentId,
        tradingDate: date,
        expectedBars: expected,
        storedBars,
        gapCount,
        firstBarAt: row?.firstBarAt ?? null,
        lastBarAt: row?.lastBarAt ?? null,
        status,
      });
    }

    return { complete, partial, missing, datesChecked: dates.length };
  }
}
