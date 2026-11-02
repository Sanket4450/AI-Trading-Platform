import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UpstoxClient,
  classifyUpstoxError,
  parseCandleEnvelope,
  type UpstoxCandleResponse,
} from '@ai-trading/adapters';
import { sha256Hex } from '@ai-trading/domain';
import {
  buildSessionWindow,
  dedupeCandles,
  istToday,
  istTradingDate,
  monthChunks,
  normalizeCandle,
  parseCandleTimestamp,
  qualityFinding,
  qualityRule,
  validateNormalizedCandle,
  type CalendarSessionRow,
  type NormalizedCandle,
  type SessionWindow,
} from '@ai-trading/market-data';
import {
  createIngestionRun,
  createRawProviderPayload,
  findChunk,
  findProviderByCode,
  findProviderMapping,
  findSucceededChunk,
  getInstrumentTickSize,
  getLatestCompletedSession,
  getParentPlanProgress,
  getPlanJob,
  getTradingCalendarRow,
  getTradingSessionsForRange,
  getUniverseMembersForBackfill,
  isMonthComplete,
  listChildJobRuns,
  refreshDailyStats,
  updateIngestionRun,
  updateJobRun,
  upsertQualityIssue,
  writeCandles,
} from '@ai-trading/database';
import { QualityService } from './quality.service.js';
import { RedisRateLimiter } from './rate-limit.service.js';

interface ChunkInput {
  providerId: string;
  parentJobRunId: string;
  instrumentId: string;
  externalKey: string;
  from: string;
  to: string;
  chunkIndex: number;
  chunkCount: number;
  runId: string;
  mode: 'missing_only' | 'force';
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly limiter: RedisRateLimiter,
    private readonly quality: QualityService,
  ) {}

  private client(): UpstoxClient {
    return new UpstoxClient({
      baseUrl: this.config.get<string>('UPSTOX_BASE_URL'),
      apiKey: this.config.get<string>('UPSTOX_API_KEY'),
      accessToken: this.config.get<string>('UPSTOX_ACCESS_TOKEN'),
      timeoutMs: this.config.get<number>('UPSTOX_REQUEST_TIMEOUT_MS', 60_000),
      networkEnabled:
        this.config.get<boolean | string>('UPSTOX_NETWORK_ENABLED', true) ===
          true || this.config.get<string>('UPSTOX_NETWORK_ENABLED') === 'true',
    });
  }

  private async issue(values: {
    ruleId: string;
    severity: 'info' | 'warning' | 'critical';
    providerId: string | null;
    instrumentId: string | null;
    tradingDate: string | null;
    windowStart: Date | null;
    windowEnd: Date | null;
    details: Record<string, unknown>;
    detectedBy: 'ingestion' | 'validation' | 'reconciliation' | 'manual';
  }): Promise<void> {
    const rule = qualityRule(values.ruleId);
    const finding = qualityFinding({
      ruleId: rule.ruleId,
      issueType: rule.issueType,
      severity: values.severity,
      providerId: values.providerId,
      instrumentId: values.instrumentId,
      tradingDate: values.tradingDate,
      windowStart: values.windowStart,
      windowEnd: values.windowEnd,
      details: values.details,
    });
    await upsertQualityIssue({ ...finding, detectedBy: values.detectedBy });
  }

  private async sessions(
    from: string,
    to: string,
  ): Promise<Map<string, SessionWindow>> {
    const rows = await getTradingSessionsForRange(from, to);
    const map = new Map<string, SessionWindow>();
    for (const row of rows) {
      const calendarRow: CalendarSessionRow = {
        exchangeId: '',
        exchangeCode: 'NSE',
        tradingDate: row.trading_date,
        isTradingDay: row.is_trading_day,
        sessionOpen: row.session_open ? new Date(row.session_open) : null,
        sessionClose: row.session_close ? new Date(row.session_close) : null,
        description: row.description,
      };
      const session = buildSessionWindow(calendarRow);
      if (session) map.set(row.trading_date, session);
    }
    return map;
  }

  private async isCancelled(
    parentJobRunId: string,
    childJobRunId?: string,
  ): Promise<boolean> {
    const parent = await getPlanJob(parentJobRunId);
    if (parent?.status === 'cancelled') return true;
    if (childJobRunId) {
      const child = await getPlanJob(childJobRunId);
      if (child?.status === 'cancelled') return true;
    }
    return false;
  }

  async runInstrumentBackfill(payload: Record<string, unknown>) {
    const childJobRunId = String(payload.jobRunId);
    const parentJobRunId = String(payload.parentJobRunId);
    const instrumentId = String(payload.instrumentId);
    const from = String(payload.from);
    const to = String(payload.to);
    const mode = payload.mode === 'force' ? 'force' : 'missing_only';

    await updateJobRun(childJobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });
    const client = this.client();
    const reason = client.configurationReason();
    if (reason) {
      const result = { skipped: true, reason };
      await updateJobRun(childJobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      await this.maybeCloseParent(parentJobRunId);
      return result;
    }

    const provider = await findProviderByCode('upstox');
    if (!provider) throw new Error('Upstox provider is not seeded');
    const mapping = await findProviderMapping(instrumentId, provider.id);
    if (!mapping) {
      await this.issue({
        ruleId: 'DQ-017',
        severity: 'critical',
        providerId: provider.id,
        instrumentId,
        tradingDate: null,
        windowStart: null,
        windowEnd: null,
        details: { reason: 'No primary Upstox mapping' },
        detectedBy: 'ingestion',
      });
      const result = { skipped: true, reason: 'mapping_missing' };
      await updateJobRun(childJobRunId, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: 'mapping_missing',
        result,
      });
      await this.maybeCloseParent(parentJobRunId);
      return result;
    }

    const chunks = monthChunks(from, to);
    let fetched = 0;
    let written = 0;
    let rejected = 0;
    let skippedChunks = 0;
    let failedChunks = 0;
    let cancelled = false;
    let lastRunId: string | null = null;

    for (const chunk of chunks) {
      if (await this.isCancelled(parentJobRunId, childJobRunId)) {
        cancelled = true;
        break;
      }
      const existing = await findChunk({
        parentJobRunId,
        instrumentId,
        chunkIndex: chunk.index,
      });
      if (existing?.status === 'succeeded' && mode !== 'force') {
        skippedChunks += 1;
        continue;
      }
      const alreadySucceeded = await findSucceededChunk({
        parentJobRunId,
        instrumentId,
        from: chunk.from,
        to: chunk.to,
      });
      if (alreadySucceeded && mode !== 'force') {
        skippedChunks += 1;
        continue;
      }
      if (
        mode === 'missing_only' &&
        (await isMonthComplete(instrumentId, chunk.from, chunk.to))
      ) {
        skippedChunks += 1;
        continue;
      }

      const run =
        existing ??
        (await createIngestionRun({
          providerId: provider.id,
          runType: 'historical_backfill',
          instrumentId,
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          requestedFrom: chunk.from,
          requestedTo: chunk.to,
          status: 'queued',
          parentJobRunId,
          chunkIndex: chunk.index,
          chunkCount: chunks.length,
          attempt: 1,
          requestFingerprint: sha256Hex(
            `${provider.id}|${mapping.externalKey}|minutes|1|${chunk.from}|${chunk.to}`,
          ),
        }));

      await updateIngestionRun(run.id, {
        status: 'running',
        startedAt: new Date(),
        attempt: (run.attempt ?? 0) + 1,
      });
      lastRunId = run.id;

      try {
        const result = await this.runChunk({
          providerId: provider.id,
          parentJobRunId,
          instrumentId,
          externalKey: mapping.externalKey,
          from: chunk.from,
          to: chunk.to,
          chunkIndex: chunk.index,
          chunkCount: chunks.length,
          runId: run.id,
          mode,
        });
        fetched += result.fetched;
        written += result.written;
        rejected += result.rejected;
        await updateIngestionRun(run.id, {
          status: result.rejected > 0 ? 'partially_failed' : 'succeeded',
          rowsFetched: result.fetched,
          rowsWritten: result.written,
          rowsRejected: result.rejected,
          rowsSkipped: result.skipped,
          rowsUpdated: result.updated,
          httpStatus: result.httpStatus,
          durationMs: result.durationMs,
          finishedAt: new Date(),
        });
      } catch (error) {
        failedChunks += 1;
        const classification = classifyUpstoxError(error);
        await updateIngestionRun(run.id, {
          status: 'failed',
          errorMessage: classification.message,
          providerErrorCode: classification.errorCode,
          httpStatus:
            error instanceof Error && 'status' in error
              ? Number((error as { status: number }).status)
              : null,
          finishedAt: new Date(),
        });
        if (classification.kind === 'throttle') {
          await this.issue({
            ruleId: 'DQ-022',
            severity: 'warning',
            providerId: provider.id,
            instrumentId,
            tradingDate: null,
            windowStart: null,
            windowEnd: null,
            details: {
              message: classification.message,
              errorCode: classification.errorCode,
            },
            detectedBy: 'ingestion',
          });
        }
        if (classification.kind === 'reference') {
          await this.issue({
            ruleId: 'DQ-018',
            severity: 'critical',
            providerId: provider.id,
            instrumentId,
            tradingDate: null,
            windowStart: null,
            windowEnd: null,
            details: {
              message: classification.message,
              externalKey: mapping.externalKey,
            },
            detectedBy: 'ingestion',
          });
        }
        this.logger.warn(
          `Chunk failed for ${instrumentId} ${chunk.from}..${chunk.to}: ${classification.message}`,
        );
      }
    }

    await this.quality.recomputeCoverage(instrumentId, from, to);
    if (lastRunId) {
      await this.quality.validateDaily(
        instrumentId,
        mapping.externalKey,
        from,
        to,
        lastRunId,
      );
    }
    await this.quality.recomputeInstrumentStatus(instrumentId);

    const status = cancelled
      ? 'cancelled'
      : failedChunks === 0
        ? 'succeeded'
        : failedChunks === chunks.length - skippedChunks
          ? 'failed'
          : 'partially_failed';
    const result = {
      fetched,
      written,
      rejected,
      skippedChunks,
      failedChunks,
      chunks: chunks.length,
    };
    await updateJobRun(childJobRunId, {
      status,
      finishedAt: new Date(),
      result,
      errorMessage: failedChunks > 0 ? `${failedChunks} chunk(s) failed` : null,
    });
    await this.maybeCloseParent(parentJobRunId);
    return result;
  }

  private async runChunk(input: ChunkInput) {
    const started = Date.now();
    await this.limiter.acquire();
    const client = this.client();
    const response = await this.withRetry(() =>
      client.fetchHistoricalCandles({
        instrumentKey: input.externalKey,
        from: input.from,
        to: input.to,
        unit: 'minutes',
        interval: 1,
      }),
    );

    const serialized = JSON.stringify(response);
    const raw = await createRawProviderPayload({
      providerId: input.providerId,
      endpoint: '/v3/historical-candle/:instrument_key/minutes/1/:to/:from',
      httpMethod: 'GET',
      requestFingerprint: sha256Hex(
        `${input.providerId}|${input.externalKey}|minutes|1|${input.from}|${input.to}`,
      ),
      requestParams: {
        instrumentKey: input.externalKey,
        from: input.from,
        to: input.to,
        unit: 'minutes',
        interval: 1,
      },
      httpStatus: 200,
      contentEncoding: null,
      payload: response,
      payloadBytes: Buffer.byteLength(serialized, 'utf8'),
      payloadSha256: sha256Hex(serialized),
      retentionClass: 'standard',
      expiresAt: new Date(
        Date.now() +
          this.config.get<number>('DATA_RETENTION_RAW_DAYS', 365) *
            24 *
            60 *
            60 *
            1000,
      ),
    });

    let parsed: UpstoxCandleResponse;
    try {
      parsed = parseCandleEnvelope(response);
    } catch (error) {
      await this.issue({
        ruleId: 'DQ-008',
        severity: 'critical',
        providerId: input.providerId,
        instrumentId: input.instrumentId,
        tradingDate: null,
        windowStart: null,
        windowEnd: null,
        details: {
          message:
            error instanceof Error ? error.message : 'Candle contract failure',
          rawPayloadId: raw.id,
        },
        detectedBy: 'ingestion',
      });
      throw error;
    }

    const sessions = await this.sessions(input.from, input.to);
    const tickSize = Number(await getInstrumentTickSize(input.instrumentId));
    const normalized: NormalizedCandle[] = [];
    let rejected = 0;

    for (const candle of parsed.data.candles) {
      let tradingDate: string;
      try {
        tradingDate = istTradingDate(parseCandleTimestamp(candle[0]));
      } catch {
        rejected += 1;
        continue;
      }
      const session = sessions.get(tradingDate) ?? null;
      if (!session) {
        rejected += 1;
        await this.issue({
          ruleId: 'DQ-005',
          severity: 'critical',
          providerId: input.providerId,
          instrumentId: input.instrumentId,
          tradingDate,
          windowStart: null,
          windowEnd: null,
          details: {
            timestamp: candle[0],
            reason: 'candle on a non-trading day',
          },
          detectedBy: 'validation',
        });
        continue;
      }
      const result = normalizeCandle(candle, {
        instrumentId: input.instrumentId,
        sourceProviderId: input.providerId,
        ingestionRunId: input.runId,
        rawPayloadId: raw.id,
        session,
        isFinal: true,
      });
      if (!result.ok) {
        rejected += 1;
        await this.issue({
          ruleId: result.reason === 'outside_session' ? 'DQ-005' : 'DQ-007',
          severity: 'critical',
          providerId: input.providerId,
          instrumentId: input.instrumentId,
          tradingDate,
          windowStart: session.open,
          windowEnd: session.close,
          details: {
            reason: result.reason,
            message: result.error,
            tuple: candle,
          },
          detectedBy: 'validation',
        });
        continue;
      }
      const validation = validateNormalizedCandle(result.row, tickSize);
      if (!validation.ok && validation.reason === 'invalid_price') {
        await this.issue({
          ruleId: 'DQ-011',
          severity: 'warning',
          providerId: input.providerId,
          instrumentId: input.instrumentId,
          tradingDate,
          windowStart: session.open,
          windowEnd: session.close,
          details: { message: validation.error, tuple: candle, tickSize },
          detectedBy: 'validation',
        });
      }
      normalized.push(result.row);
    }

    const deduped = dedupeCandles(normalized);
    for (const duplicate of deduped.duplicates) {
      await this.issue({
        ruleId: 'DQ-009',
        severity: 'warning',
        providerId: input.providerId,
        instrumentId: input.instrumentId,
        tradingDate: istTradingDate(duplicate.timestamp),
        windowStart: duplicate.timestamp,
        windowEnd: duplicate.timestamp,
        details: {
          kept: { ...duplicate.kept },
          dropped: { ...duplicate.dropped },
          rawPayloadId: raw.id,
        },
        detectedBy: 'validation',
      });
    }

    const write = await writeCandles(deduped.rows);
    for (const revision of write.revisions) {
      await this.issue({
        ruleId: 'DQ-015',
        severity: 'warning',
        providerId: input.providerId,
        instrumentId: input.instrumentId,
        tradingDate: istTradingDate(revision.candleStart),
        windowStart: revision.candleStart,
        windowEnd: revision.candleStart,
        details: {
          old: revision.old,
          incoming: revision.incoming,
          rawPayloadId: raw.id,
        },
        detectedBy: 'validation',
      });
    }

    return {
      fetched: parsed.data.candles.length,
      written: write.inserted + write.updated,
      updated: write.updated,
      skipped: write.skipped,
      rejected,
      httpStatus: 200,
      durationMs: Date.now() - started,
    };
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = this.config.get<number>('UPSTOX_MAX_ATTEMPTS', 5);
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const classification = classifyUpstoxError(error);
        if (!classification.retryable) throw error;
        const backoff =
          Math.min(30_000, 2 ** (attempt - 1) * 1000) + Math.random() * 250;
        if (classification.kind === 'throttle') {
          await this.limiter.pause(
            (classification.retryAfterSeconds ?? Math.ceil(backoff / 1000)) *
              1000,
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }
    throw lastError;
  }

  async intradaySync(jobRunId: string) {
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
    const today = istToday();
    const calendar = await getTradingCalendarRow(today);
    if (!calendar?.is_trading_day) {
      const result = {
        skipped: true,
        reason: 'not a trading day',
        date: today,
      };
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      return result;
    }

    const session = buildSessionWindow({
      exchangeId: '',
      exchangeCode: 'NSE',
      tradingDate: today,
      isTradingDay: true,
      sessionOpen: calendar.session_open
        ? new Date(calendar.session_open)
        : null,
      sessionClose: calendar.session_close
        ? new Date(calendar.session_close)
        : null,
    });
    const members = await getUniverseMembersForBackfill('nifty-50');
    let instruments = 0;
    let rowsWritten = 0;
    for (const member of members) {
      const mapping = await findProviderMapping(
        member.instrumentId,
        provider.id,
      );
      if (!mapping) continue;
      try {
        await this.limiter.acquire();
        const response = await this.withRetry(() =>
          client.fetchIntradayCandles({ instrumentKey: mapping.externalKey }),
        );
        const serialized = JSON.stringify(response);
        const raw = await createRawProviderPayload({
          providerId: provider.id,
          endpoint: '/v3/historical-candle/intraday/:instrument_key/minutes/1',
          httpMethod: 'GET',
          requestFingerprint: sha256Hex(
            `intraday|${mapping.externalKey}|${today}`,
          ),
          requestParams: {
            instrumentKey: mapping.externalKey,
            unit: 'minutes',
            interval: 1,
          },
          httpStatus: 200,
          contentEncoding: null,
          payload: response,
          payloadBytes: Buffer.byteLength(serialized, 'utf8'),
          payloadSha256: sha256Hex(serialized),
          retentionClass: 'standard',
          expiresAt: new Date(
            Date.now() +
              this.config.get<number>('DATA_RETENTION_RAW_DAYS', 365) *
                86_400_000,
          ),
        });
        const parsed = parseCandleEnvelope(response);
        const run = await createIngestionRun({
          providerId: provider.id,
          runType: 'intraday_sync',
          instrumentId: member.instrumentId,
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          requestedFrom: today,
          requestedTo: today,
          status: 'running',
        });
        await updateIngestionRun(run.id, {
          status: 'running',
          startedAt: new Date(),
        });
        const rows = [];
        for (const [index, candle] of parsed.data.candles.entries()) {
          const result = normalizeCandle(candle, {
            instrumentId: member.instrumentId,
            sourceProviderId: provider.id,
            ingestionRunId: run.id,
            rawPayloadId: raw.id,
            session,
            isFinal: index !== parsed.data.candles.length - 1,
          });
          if (result.ok) rows.push(result.row);
        }
        const write = await writeCandles(rows);
        rowsWritten += write.inserted + write.updated;
        instruments += 1;
        await updateIngestionRun(run.id, {
          status: 'succeeded',
          rowsFetched: parsed.data.candles.length,
          rowsWritten: write.inserted + write.updated,
          rowsSkipped: write.skipped,
          finishedAt: new Date(),
        });
        await this.issue({
          ruleId: 'DQ-004',
          severity: 'info',
          providerId: provider.id,
          instrumentId: member.instrumentId,
          tradingDate: today,
          windowStart: session?.open ?? null,
          windowEnd: session?.close ?? null,
          details: { reason: 'current-session final bar is not final' },
          detectedBy: 'ingestion',
        });
        await this.quality.recomputeCoverage(member.instrumentId, today, today);
        await this.quality.recomputeInstrumentStatus(member.instrumentId);
      } catch (error) {
        this.logger.warn(
          `Intraday sync failed for ${member.symbol}: ${String(error)}`,
        );
      }
    }
    const result = { instruments, rowsWritten, date: today };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    return result;
  }

  async historicalFinalize(jobRunId: string, payload: Record<string, unknown>) {
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
    const latest = await getLatestCompletedSession();
    if (!latest) {
      const result = { skipped: true, reason: 'no completed session' };
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      return result;
    }
    const dates = await this.finalizeDates(latest, Boolean(payload.catchUp));
    const members = await getUniverseMembersForBackfill('nifty-50');
    let instruments = 0;
    let rowsWritten = 0;
    for (const member of members) {
      const mapping = await findProviderMapping(
        member.instrumentId,
        provider.id,
      );
      if (!mapping) continue;
      for (const date of dates) {
        const run = await createIngestionRun({
          providerId: provider.id,
          runType: 'historical_repair',
          instrumentId: member.instrumentId,
          timeframeUnit: 'minutes',
          timeframeInterval: 1,
          requestedFrom: date,
          requestedTo: date,
          status: 'queued',
          parentJobRunId: jobRunId,
          chunkIndex: dates.indexOf(date),
          chunkCount: dates.length,
        });
        await updateIngestionRun(run.id, {
          status: 'running',
          startedAt: new Date(),
        });
        try {
          const result = await this.runChunk({
            providerId: provider.id,
            parentJobRunId: jobRunId,
            instrumentId: member.instrumentId,
            externalKey: mapping.externalKey,
            from: date,
            to: date,
            chunkIndex: dates.indexOf(date),
            chunkCount: dates.length,
            runId: run.id,
            mode: 'force',
          });
          rowsWritten += result.written;
          await updateIngestionRun(run.id, {
            status: 'succeeded',
            rowsFetched: result.fetched,
            rowsWritten: result.written,
            rowsSkipped: result.skipped,
            rowsRejected: result.rejected,
            httpStatus: result.httpStatus,
            durationMs: result.durationMs,
            finishedAt: new Date(),
          });
          await this.quality.validateDaily(
            member.instrumentId,
            mapping.externalKey,
            date,
            date,
            run.id,
          );
          await this.quality.recomputeCoverage(member.instrumentId, date, date);
          await this.quality.recomputeInstrumentStatus(member.instrumentId);
          instruments += 1;
        } catch (error) {
          await updateIngestionRun(run.id, {
            status: 'failed',
            errorMessage:
              error instanceof Error ? error.message : 'Finalize failed',
            finishedAt: new Date(),
          });
        }
      }
    }
    const result = { instruments, rowsWritten, dates };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    await refreshDailyStats();
    return result;
  }

  private async finalizeDates(
    latest: string,
    catchUp: boolean,
  ): Promise<string[]> {
    const from = new Date(`${latest}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 14);
    const rows = await getTradingSessionsForRange(
      from.toISOString().slice(0, 10),
      latest,
    );
    const tradingDates = rows
      .filter((row) => row.is_trading_day)
      .map((row) => row.trading_date)
      .filter((date) => date <= latest);
    if (!catchUp) return tradingDates.slice(-1);
    return tradingDates.slice(-10);
  }

  async coverageRecompute(jobRunId: string, payload: Record<string, unknown>) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });
    const latest =
      (await getLatestCompletedSession()) ??
      new Date().toISOString().slice(0, 10);
    const from = typeof payload.from === 'string' ? payload.from : '2022-01-01';
    const to = typeof payload.to === 'string' ? payload.to : latest;
    const requestedIds = Array.isArray(payload.instrumentIds)
      ? payload.instrumentIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    const instrumentId =
      typeof payload.instrumentId === 'string' ? payload.instrumentId : null;
    const members =
      requestedIds.length > 0
        ? requestedIds.map((id) => ({ instrumentId: id }))
        : instrumentId
          ? [{ instrumentId }]
          : await getUniverseMembersForBackfill('nifty-50');
    let recomputed = 0;
    for (const member of members) {
      await this.quality.recomputeCoverage(member.instrumentId, from, to);
      await this.quality.recomputeInstrumentStatus(member.instrumentId);
      recomputed += 1;
    }
    const result = { recomputed, from, to };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    return result;
  }

  async qualityScanJob(jobRunId: string, payload: Record<string, unknown>) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });
    const result = await this.quality.qualityScan({
      days: payload.days ? Number(payload.days) : 10,
      full: payload.full === true,
    });
    const stale = await this.quality.detectStaleIngestion();
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result: { ...result, stale },
    });
    return result;
  }

  async dailyValidationJob(jobRunId: string, payload: Record<string, unknown>) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });
    const latest =
      (await getLatestCompletedSession()) ??
      new Date().toISOString().slice(0, 10);
    const days = Number(payload.days ?? 1);
    const from = new Date(`${latest}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - days);
    const provider = await findProviderByCode('upstox');
    if (!provider) throw new Error('Upstox provider is not seeded');
    const members = await getUniverseMembersForBackfill('nifty-50');
    let validated = 0;
    for (const member of members) {
      const mapping = await findProviderMapping(
        member.instrumentId,
        provider.id,
      );
      if (!mapping) continue;
      const result = await this.quality.validateDaily(
        member.instrumentId,
        mapping.externalKey,
        from.toISOString().slice(0, 10),
        latest,
        null,
      );
      if (!('skipped' in result) || !result.skipped) validated += 1;
      await this.quality.recomputeCoverage(
        member.instrumentId,
        from.toISOString().slice(0, 10),
        latest,
      );
      await this.quality.recomputeInstrumentStatus(member.instrumentId);
    }
    const result = {
      validated,
      from: from.toISOString().slice(0, 10),
      to: latest,
    };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    return result;
  }

  async ingestionReconcile(jobRunId: string) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
      attempt: 1,
    });
    const { markStaleRunsFailed } = await import('@ai-trading/database');
    const stale = await markStaleRunsFailed(15);
    for (const run of stale) {
      await this.issue({
        ruleId: 'DQ-023',
        severity: 'warning',
        providerId: run.providerId,
        instrumentId: run.instrumentId,
        tradingDate: null,
        windowStart: null,
        windowEnd: null,
        details: {
          runId: run.id,
          startedAt: run.startedAt?.toISOString() ?? null,
        },
        detectedBy: 'reconciliation',
      });
    }
    const result = { recovered: stale.length };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    return result;
  }

  async maybeCloseParent(parentJobRunId: string): Promise<void> {
    const parent = await getPlanJob(parentJobRunId);
    if (
      !parent ||
      parent.status === 'succeeded' ||
      parent.status === 'failed' ||
      parent.status === 'partially_failed' ||
      parent.status === 'cancelled'
    ) {
      return;
    }
    const children = await listChildJobRuns(parentJobRunId);
    if (children.length === 0) return;
    const latestByInstrument = new Map<string, (typeof children)[number]>();
    for (const child of children) {
      const instrumentId =
        typeof (child.payload as Record<string, unknown> | null)
          ?.instrumentId === 'string'
          ? String((child.payload as Record<string, unknown>).instrumentId)
          : child.id;
      const existing = latestByInstrument.get(instrumentId);
      if (!existing || child.createdAt > existing.createdAt) {
        latestByInstrument.set(instrumentId, child);
      }
    }
    const latest = [...latestByInstrument.values()];
    if (
      latest.some(
        (child) => child.status === 'queued' || child.status === 'running',
      )
    )
      return;
    const progress = await getParentPlanProgress(parentJobRunId);
    const status =
      parent.status === 'cancelled'
        ? 'cancelled'
        : latest.every((child) => child.status === 'succeeded')
          ? 'succeeded'
          : latest.every((child) => child.status === 'failed')
            ? 'failed'
            : 'partially_failed';
    await updateJobRun(parentJobRunId, {
      status,
      finishedAt: new Date(),
      result: progress as unknown as Record<string, unknown>,
    });
    await refreshDailyStats();
  }
}
