import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UpstoxClient,
  classifyUpstoxError,
  type UpstoxInstrument,
} from '@ai-trading/adapters';
import { sha256Hex } from '@ai-trading/domain';
import { istToday, qualityFinding, qualityRule } from '@ai-trading/market-data';
import {
  createInstrumentStatusRows,
  createRawProviderPayload,
  findExchangeByCode,
  findProviderByCode,
  getLatestCompletedSession,
  getTradingCalendarRow,
  getUniverseMembersForBackfill,
  isR2Instrument,
  paiseToTickSize,
  syncTradingCalendarFixture,
  updateJobRun,
  upsertInstrumentMasterRows,
  upsertQualityIssue,
  type InstrumentMasterRow,
} from '@ai-trading/database';

@Injectable()
export class ReferenceSyncService {
  private readonly logger = new Logger(ReferenceSyncService.name);

  constructor(private readonly config: ConfigService) {}

  private client(): UpstoxClient {
    return new UpstoxClient({
      baseUrl: this.config.get<string>('UPSTOX_BASE_URL'),
      instrumentsUrl: this.config.get<string>('UPSTOX_INSTRUMENTS_URL'),
      apiKey: this.config.get<string>('UPSTOX_API_KEY'),
      accessToken: this.config.get<string>('UPSTOX_ACCESS_TOKEN'),
      timeoutMs: this.config.get<number>('UPSTOX_REQUEST_TIMEOUT_MS', 60_000),
      networkEnabled:
        this.config.get<boolean | string>('UPSTOX_NETWORK_ENABLED', true) ===
          true || this.config.get<string>('UPSTOX_NETWORK_ENABLED') === 'true',
    });
  }

  async instrumentSync(jobRunId: string) {
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

    try {
      const provider = await findProviderByCode('upstox');
      if (!provider) throw new Error('Upstox provider is not seeded');
      const master = await client.fetchInstrumentMaster();
      const serialized = JSON.stringify(master);
      const raw = await createRawProviderPayload({
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
        expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
      });

      const safetyCap = this.config.get<number>(
        'INSTRUMENT_SYNC_LIMIT',
        20_000,
      );
      const rows: InstrumentMasterRow[] = master
        .filter((instrument: UpstoxInstrument) => {
          if (!instrument.instrument_key || !instrument.trading_symbol)
            return false;
          const segment = instrument.segment ?? '';
          const type =
            instrument.instrument_type ??
            (segment.endsWith('_INDEX') ? 'INDEX' : 'EQ');
          return isR2Instrument(segment, type);
        })
        .slice(0, safetyCap)
        .map((instrument) => {
          const segment = instrument.segment ?? 'NSE_EQ';
          const instrumentType =
            instrument.instrument_type ??
            (segment.endsWith('_INDEX') ? 'INDEX' : 'EQ');
          return {
            externalKey: instrument.instrument_key,
            exchangeCode: 'NSE',
            tradingSymbol: instrument.trading_symbol ?? '',
            name: (instrument.name ?? instrument.trading_symbol ?? '')
              .trim()
              .replace(/\s+/g, ' '),
            shortName: instrument.short_name?.trim() || null,
            isin: instrument.isin ? instrument.isin.toUpperCase() : null,
            segment,
            instrumentType,
            lotSize: instrument.lot_size ?? 1,
            tickSize:
              instrumentType === 'INDEX'
                ? '0.1000'
                : paiseToTickSize(instrument.tick_size, '0.0500'),
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

      const result = await upsertInstrumentMasterRows(provider.id, rows, {
        safetyCap,
        indexTickFallback: '0.1000',
      });

      const members = await getUniverseMembersForBackfill('nifty-50');
      const lastCompleted =
        (await getLatestCompletedSession()) ??
        new Date().toISOString().slice(0, 10);
      await createInstrumentStatusRows(
        members.map((member) => member.instrumentId),
        '2022-01-01',
        lastCompleted,
      );

      if (result.excluded > 0) {
        const finding = qualityFinding({
          ruleId: qualityRule('DQ-019').ruleId,
          issueType: 'unsupported_instrument',
          severity: 'info',
          providerId: provider.id,
          instrumentId: null,
          tradingDate: null,
          windowStart: null,
          windowEnd: null,
          details: {
            excluded: result.excluded,
            limited: result.limited,
            rawPayloadId: raw.id,
          },
        });
        await upsertQualityIssue({
          ...finding,
          detectedBy: 'reconciliation',
        });
      }

      const summary = {
        fetched: master.length,
        ...result,
        statusRows: members.length,
        rawPayloadId: raw.id,
      };
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result: summary,
      });
      this.logger.log(`Instrument sync complete: ${JSON.stringify(summary)}`);
      return summary;
    } catch (error) {
      const classification = classifyUpstoxError(error);
      await updateJobRun(jobRunId, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: classification.message,
      });
      throw error;
    }
  }

  async calendarSync(jobRunId: string) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });
    const provider = await findProviderByCode('upstox');
    const exchange = await findExchangeByCode('NSE');
    if (!provider || !exchange) throw new Error('Reference data is not seeded');

    const years = [2022, 2023, 2024, 2025, 2026, 2027];
    const rows = await syncTradingCalendarFixture(
      exchange.id,
      provider.id,
      years,
    );
    const result: Record<string, unknown> = {
      rows,
      years,
      source: 'nse-reviewed-fixture',
      reconciled: false,
      mismatches: 0,
    };

    const client = this.client();
    if (!client.configurationReason()) {
      try {
        const holidays = await client.fetchMarketHolidays();
        const serialized = JSON.stringify(holidays);
        await createRawProviderPayload({
          providerId: provider.id,
          endpoint: '/v2/market/holidays',
          httpMethod: 'GET',
          requestFingerprint: sha256Hex('market-holidays|current-year'),
          requestParams: null,
          httpStatus: 200,
          contentEncoding: null,
          payload: holidays,
          payloadBytes: Buffer.byteLength(serialized, 'utf8'),
          payloadSha256: sha256Hex(serialized),
          retentionClass: 'extended',
          expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
        });
        const mismatches = await this.reconcileHolidays(provider.id, holidays);
        const today = istToday();
        const timings = await client.fetchMarketTimings(today);
        const nseTiming = timings.find((timing) => timing.exchange === 'NSE');
        const calendarRow = await getTradingCalendarRow(today);
        if (
          nseTiming &&
          calendarRow?.session_open &&
          calendarRow.session_close
        ) {
          const expectedOpen = new Date(nseTiming.start_time).toISOString();
          const expectedClose = new Date(nseTiming.end_time).toISOString();
          const actualOpen = new Date(calendarRow.session_open).toISOString();
          const actualClose = new Date(calendarRow.session_close).toISOString();
          if (expectedOpen !== actualOpen || expectedClose !== actualClose) {
            await this.recordCalendarMismatch(provider.id, today, {
              expected: { open: expectedOpen, close: expectedClose },
              observed: { open: actualOpen, close: actualClose },
              source: 'market-timings',
            });
            result.mismatches = Number(result.mismatches ?? 0) + 1;
          }
        }
        result.reconciled = true;
        result.mismatches = Number(result.mismatches ?? 0) + mismatches;
      } catch (error) {
        this.logger.warn(`Calendar reconciliation skipped: ${String(error)}`);
        result.reconciliationError =
          error instanceof Error
            ? error.message
            : 'Calendar reconciliation failed';
      }
    }

    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    return result;
  }

  private async reconcileHolidays(
    providerId: string,
    holidays: Awaited<ReturnType<UpstoxClient['fetchMarketHolidays']>>,
  ): Promise<number> {
    let mismatches = 0;
    for (const holiday of holidays) {
      const closed = holiday.closed_exchanges?.includes('NSE') ?? false;
      const open = holiday.open_exchanges?.find(
        (session) => session.exchange === 'NSE',
      );
      const date = holiday.date;
      const row = await getTradingCalendarRow(date);
      if (!row) continue;
      if (closed && row.is_trading_day) {
        await this.recordCalendarMismatch(providerId, date, {
          expected: 'closed',
          observed: 'trading',
          description: holiday.description,
        });
        mismatches += 1;
      }
      if (open) {
        const expectedOpen = new Date(open.start_time).toISOString();
        const expectedClose = new Date(open.end_time).toISOString();
        const actualOpen = row.session_open
          ? new Date(row.session_open).toISOString()
          : null;
        const actualClose = row.session_close
          ? new Date(row.session_close).toISOString()
          : null;
        if (actualOpen !== expectedOpen || actualClose !== expectedClose) {
          await this.recordCalendarMismatch(providerId, date, {
            expected: { open: expectedOpen, close: expectedClose },
            observed: { open: actualOpen, close: actualClose },
            description: holiday.description,
          });
          mismatches += 1;
        }
      }
    }
    return mismatches;
  }

  private async recordCalendarMismatch(
    providerId: string,
    date: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    const finding = qualityFinding({
      ruleId: 'DQ-005',
      issueType: 'calendar_mismatch',
      severity: 'critical',
      providerId,
      instrumentId: null,
      tradingDate: date,
      windowStart: null,
      windowEnd: null,
      details,
    });
    await upsertQualityIssue({ ...finding, detectedBy: 'reconciliation' });
  }
}
