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
  fetchStatusFromRun,
  HISTORY_START,
  istToday,
  istTradingDate,
  issueDedupeKey,
  monthChunks,
  normalizeCandle,
  parseCandleTimestamp,
  validateNormalizedCandle,
  type CalendarSessionRow,
  type NormalizedCandle,
  type SessionWindow,
} from '@ai-trading/market-data';
import {
  clearSystemIssue,
  clearSystemIssues,
  closeJobRun,
  correctStalledFetchStatus,
  createRawProviderPayload,
  deleteAllCoverage,
  findProviderByCode,
  findProviderMapping,
  getInstrumentTickSize,
  getJobRun,
  getLatestBackfillJobForInstrument,
  getLatestCompletedSession,
  getTradingCalendarRow,
  getTradingSessionsForRange,
  getSyncTargetInstruments,
  isMonthComplete,
  markInstrumentFetchInFlight,
  markStaleJobsFailed,
  refreshDailyStats,
  updateJobRun,
  writeCandles,
} from '@ai-trading/database';
import { JobTrackingService } from '../../observability/job-tracking.service.js';
import { ExternalApiRecorder } from '../../observability/external-api-recorder.js';
import { recordIssue } from './issue-recorder.js';
import { QualityService } from './quality.service.js';
import { RedisRateLimiter } from './rate-limit.service.js';
import { StaleJobSweeper } from './stale-job.sweeper.js';

interface ChunkInput {
  jobRunId: string;
  providerId: string;
  instrumentId: string;
  externalKey: string;
  from: string;
  to: string;
  chunkIndex: number;
  chunkCount: number;
  mode: 'missing_only' | 'force';
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly limiter: RedisRateLimiter,
    private readonly quality: QualityService,
    private readonly tracking: JobTrackingService,
    private readonly recorder: ExternalApiRecorder,
    private readonly staleJobs: StaleJobSweeper,
  ) {}

  private client(jobRunId: string | null): UpstoxClient {
    return new UpstoxClient({
      baseUrl: this.config.get<string>('UPSTOX_BASE_URL'),
      apiKey: this.config.get<string>('UPSTOX_API_KEY'),
      accessToken: this.config.get<string>('UPSTOX_ACCESS_TOKEN'),
      timeoutMs: this.config.get<number>('UPSTOX_REQUEST_TIMEOUT_MS', 60_000),
      networkEnabled:
        this.config.get<boolean | string>('UPSTOX_NETWORK_ENABLED', true) ===
          true || this.config.get<string>('UPSTOX_NETWORK_ENABLED') === 'true',
      sink: this.recorder,
      context: { jobRunId },
    });
  }

  private issue(values: Parameters<typeof recordIssue>[0]): Promise<void> {
    return recordIssue(values);
  }

  /** Deletes the exact issue a previous failed chunk raised. */
  private clearChunkIssue(input: {
    providerId: string;
    instrumentId: string;
    from: string;
    to: string;
    ruleId: string;
    kind: string;
  }) {
    return clearSystemIssue(
      issueDedupeKey({
        source: 'ingestion',
        kind: input.kind,
        providerId: input.providerId,
        instrumentId: input.instrumentId,
        scope: { ruleId: input.ruleId, from: input.from, to: input.to },
      }),
    );
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
        sessionBreaks: row.session_breaks ?? [],
        description: row.description,
      };
      const session = buildSessionWindow(calendarRow);
      if (session) map.set(row.trading_date, session);
    }
    return map;
  }

  private async isCancelled(jobRunId: string): Promise<boolean> {
    const run = await getJobRun(jobRunId);
    return run?.status === 'cancelled';
  }

  async runInstrumentBackfill(payload: Record<string, unknown>) {
    const jobRunId = String(payload.jobRunId);
    const instrumentId = String(payload.instrumentId);
    const from = String(payload.from);
    const to = String(payload.to);
    const mode = payload.mode === 'force' ? 'force' : 'missing_only';

    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
    });
    await markInstrumentFetchInFlight(instrumentId, 'fetching');
    const client = this.client(jobRunId);
    const reason = client.configurationReason();
    if (reason) {
      const result = { skipped: true, reason };
      this.tracking.completeStage(jobRunId, 'prepare', 'skipped', { reason: 'not_configured' });
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      // A skipped run is not fetch evidence: settle against the runs before it.
      await this.settleFetchStatus(instrumentId, { excludeJobRunId: jobRunId });
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
        source: 'ingestion',
        scope: {},
        payload: { reason: 'No primary Upstox mapping' },
      });
      const result = { skipped: true, reason: 'mapping_missing' };
      this.tracking.completeStage(jobRunId, 'prepare', 'failed', { reason: 'mapping_missing' });
      await updateJobRun(jobRunId, {
        status: 'failed',
        finishedAt: new Date(),
        error: { code: 'mapping_missing', message: 'No primary Upstox mapping', retryable: false },
        result,
      });
      await this.settleFetchStatus(instrumentId);
      return result;
    }

    await clearSystemIssues({
      sources: ['ingestion'],
      kinds: ['mapping_missing'],
      instrumentId,
    });
    // Tick alignment is an instrument property. Recheck it once per backfill
    // instead of leaving one warning per historical day.
    await clearSystemIssues({
      sources: ['validation'],
      kinds: ['tick_size_mismatch'],
      instrumentId,
    });

    const chunks = monthChunks(from, to);
    let fetched = 0;
    let written = 0;
    let rejected = 0;
    let skippedChunks = 0;
    let failedChunks = 0;
    let cancelled = false;

    this.tracking.completeStage(jobRunId, 'prepare');
    this.tracking.enterStage(jobRunId, 'chunks');

    for (const chunk of chunks) {
      if (await this.isCancelled(jobRunId)) {
        cancelled = true;
        break;
      }
      if (
        mode === 'missing_only' &&
        (await isMonthComplete(instrumentId, chunk.from, chunk.to))
      ) {
        await this.clearChunkIssue({
          providerId: provider.id,
          instrumentId,
          from: chunk.from,
          to: chunk.to,
          ruleId: 'DQ-026',
          kind: 'candle_fetch_failed',
        });
        await this.clearChunkIssue({
          providerId: provider.id,
          instrumentId,
          from: chunk.from,
          to: chunk.to,
          ruleId: 'DQ-008',
          kind: 'schema_invalid',
        });
        skippedChunks += 1;
        this.tracking.progress(jobRunId, 'chunks', {
          index: chunk.index + 1,
          total: chunks.length,
          from: chunk.from,
          to: chunk.to,
          status: 'skipped',
        });
        continue;
      }

      try {
        const result = await this.runChunk({
          jobRunId,
          providerId: provider.id,
          instrumentId,
          externalKey: mapping.externalKey,
          from: chunk.from,
          to: chunk.to,
          chunkIndex: chunk.index,
          chunkCount: chunks.length,
          mode,
        });
        fetched += result.fetched;
        written += result.written;
        rejected += result.rejected;
        this.tracking.progress(jobRunId, 'chunks', {
          index: chunk.index + 1,
          total: chunks.length,
          from: chunk.from,
          to: chunk.to,
          status: 'completed',
          fetched: result.fetched,
          written: result.written,
          updated: result.updated,
          rejected: result.rejected,
          durationMs: result.durationMs,
        });
      } catch (error) {
        failedChunks += 1;
        const classification = classifyUpstoxError(error);
        const fatal = ['reference', 'auth', 'permission', 'contract'].includes(
          classification.kind,
        );
        await this.issue({
          ruleId: 'DQ-026',
          severity: fatal ? 'critical' : 'warning',
          providerId: provider.id,
          instrumentId,
          source: 'ingestion',
          scope: { from: chunk.from, to: chunk.to },
          payload: {
            from: chunk.from,
            to: chunk.to,
            chunkIndex: chunk.index,
            chunkCount: chunks.length,
            error: {
              kind: classification.kind,
              code: classification.errorCode,
              message: classification.message,
              retryable: classification.retryable,
              retryAfterSeconds: classification.retryAfterSeconds,
              attempts: this.config.get<number>('UPSTOX_MAX_ATTEMPTS', 5),
            },
          },
        });
        this.logger.warn(
          `Chunk failed for ${instrumentId} ${chunk.from}..${chunk.to}: ${classification.message}`,
        );
        this.tracking.warning(jobRunId, 'chunks', {
          index: chunk.index + 1,
          total: chunks.length,
          from: chunk.from,
          to: chunk.to,
          code: classification.kind,
          errorCode: classification.errorCode,
          retryable: classification.retryable,
        });
      }
    }

    this.tracking.completeStage(jobRunId, 'chunks', 'completed', {
      completed: chunks.length - skippedChunks,
      total: chunks.length,
      fetched,
      written,
      rejected,
      skipped: skippedChunks,
      failed: failedChunks,
    });
    this.tracking.enterStage(jobRunId, 'finalize');

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
    // Close first: the projection reads the run's terminal status and its finish time.
    await closeJobRun({
      jobRunId,
      status,
      result,
      error:
        failedChunks > 0
          ? {
              code: 'chunks_failed',
              message: `${failedChunks} chunk(s) failed`,
              retryable: false,
              details: { failedChunks, chunks: chunks.length },
            }
          : null,
    });
    await this.quality.recomputeCoverage(instrumentId, from, to);
    await this.quality.recomputeInstrumentStatus(instrumentId);
    this.tracking.completeStage(jobRunId, 'finalize', cancelled ? 'skipped' : 'completed', {
      fetched,
      written,
      rejected,
      skippedChunks,
      failedChunks,
    });
    return result;
  }

  /**
   * Re-derives fetch status from the latest backfill run and releases the in-flight marker left
   * by a run that never reached the chunk loop. Only queued/fetching rows are rewritten.
   */
  private async settleFetchStatus(
    instrumentId: string,
    options: { excludeJobRunId?: string } = {},
  ) {
    const latest = await getLatestBackfillJobForInstrument(instrumentId, options);
    await correctStalledFetchStatus(instrumentId, fetchStatusFromRun(latest));
  }

  private async runChunk(input: ChunkInput) {
    const started = Date.now();
    await this.limiter.acquire();
    const client = this.client(input.jobRunId);
    const response = await this.withRetry(() =>
      client.fetchHistoricalCandles({
        instrumentKey: input.externalKey,
        from: input.from,
        to: input.to,
        unit: 'minutes',
        interval: 1,
        instrumentId: input.instrumentId,
      }),
    );

    const serialized = JSON.stringify(response);
    const raw = await createRawProviderPayload({
      providerId: input.providerId,
      endpoint: '/v3/historical-candle/:instrument_key/minutes/1/:to/:from',
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
        source: 'ingestion',
        scope: { from: input.from, to: input.to },
        payload: {
          from: input.from,
          to: input.to,
          message:
            error instanceof Error ? error.message : 'Candle contract failure',
          rawPayloadId: raw.id,
        },
      });
      throw error;
    }

    const sessions = await this.sessions(input.from, input.to);
    for (const tradingDate of sessions.keys()) {
      await clearSystemIssues({
        sources: ['validation'],
        kinds: ['calendar_mismatch', 'invalid_ohlc', 'duplicate_bar', 'provider_revision'],
        instrumentId: input.instrumentId,
        tradingDate,
      });
    }
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
          source: 'validation',
          scope: { tradingDate },
          payload: {
            tradingDate,
            timestamp: candle[0],
            reason: 'candle on a non-trading day',
          },
        });
        continue;
      }
      const result = normalizeCandle(candle, {
        instrumentId: input.instrumentId,
        sourceProviderId: input.providerId,
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
          source: 'validation',
          scope: {
            tradingDate,
            windowStart: session.open.toISOString(),
            windowEnd: session.close.toISOString(),
          },
          payload: {
            tradingDate,
            windowStart: session.open.toISOString(),
            windowEnd: session.close.toISOString(),
            reason: result.reason,
            message: result.error,
            tuple: candle,
          },
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
          source: 'validation',
          scope: { tickSize },
          payload: {
            tradingDate,
            windowStart: session.open.toISOString(),
            windowEnd: session.close.toISOString(),
            message: validation.error,
            tuple: candle,
            tickSize,
          },
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
        source: 'validation',
        scope: {
          tradingDate: istTradingDate(duplicate.timestamp),
          candleStart: duplicate.timestamp.toISOString(),
        },
        payload: {
          tradingDate: istTradingDate(duplicate.timestamp),
          candleStart: duplicate.timestamp.toISOString(),
          kept: { ...duplicate.kept },
          dropped: { ...duplicate.dropped },
          rawPayloadId: raw.id,
        },
      });
    }

    const write = await writeCandles(deduped.rows);
    for (const revision of write.revisions) {
      await this.issue({
        ruleId: 'DQ-015',
        severity: 'warning',
        providerId: input.providerId,
        instrumentId: input.instrumentId,
        source: 'validation',
        scope: {
          tradingDate: istTradingDate(revision.candleStart),
          candleStart: revision.candleStart.toISOString(),
        },
        payload: {
          tradingDate: istTradingDate(revision.candleStart),
          candleStart: revision.candleStart.toISOString(),
          old: revision.old,
          incoming: revision.incoming,
          rawPayloadId: raw.id,
        },
      });
    }

    await this.clearChunkIssue({
      providerId: input.providerId,
      instrumentId: input.instrumentId,
      from: input.from,
      to: input.to,
      ruleId: 'DQ-026',
      kind: 'candle_fetch_failed',
    });
    await this.clearChunkIssue({
      providerId: input.providerId,
      instrumentId: input.instrumentId,
      from: input.from,
      to: input.to,
      ruleId: 'DQ-008',
      kind: 'schema_invalid',
    });

    return {
      fetched: parsed.data.candles.length,
      written: write.inserted + write.updated,
      updated: write.updated,
      skipped: write.skipped,
      rejected,
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
    });
    const client = this.client(jobRunId);
    const reason = client.configurationReason();
    if (reason) {
      const result = { skipped: true, reason };
      this.tracking.completeStage(jobRunId, 'prepare', 'skipped', { reason: 'not_configured' });
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
      this.tracking.completeStage(jobRunId, 'prepare', 'skipped', { reason: 'not_a_trading_day' });
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
      sessionBreaks: calendar.session_breaks ?? [],
    });
    const targets = await getSyncTargetInstruments();
    let instruments = 0;
    let rowsWritten = 0;
    this.tracking.completeStage(jobRunId, 'prepare');
    this.tracking.enterStage(jobRunId, 'instruments');
    for (const target of targets) {
      const mapping = await findProviderMapping(
        target.instrumentId,
        provider.id,
      );
      if (!mapping) continue;
      try {
        await this.limiter.acquire();
        const response = await this.withRetry(() =>
          client.fetchIntradayCandles({
            instrumentKey: mapping.externalKey,
            instrumentId: target.instrumentId,
          }),
        );
        const serialized = JSON.stringify(response);
        const raw = await createRawProviderPayload({
          providerId: provider.id,
          endpoint: '/v3/historical-candle/intraday/:instrument_key/minutes/1',
          requestFingerprint: sha256Hex(
            `intraday|${mapping.externalKey}|${today}`,
          ),
          requestParams: {
            instrumentKey: mapping.externalKey,
            unit: 'minutes',
            interval: 1,
          },
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
        const rows = [];
        for (const [index, candle] of parsed.data.candles.entries()) {
          const result = normalizeCandle(candle, {
            instrumentId: target.instrumentId,
            sourceProviderId: provider.id,
            rawPayloadId: raw.id,
            session,
            isFinal: index !== parsed.data.candles.length - 1,
          });
          if (result.ok) rows.push(result.row);
        }
        const write = await writeCandles(rows);
        rowsWritten += write.inserted + write.updated;
        instruments += 1;
        await this.quality.recomputeCoverage(target.instrumentId, today, today);
        await this.quality.recomputeInstrumentStatus(target.instrumentId);
        this.tracking.progress(jobRunId, 'instruments', {
          index: instruments,
          total: targets.length,
          instrumentId: target.instrumentId,
          symbol: target.symbol,
          written: write.inserted + write.updated,
        });
      } catch (error) {
        this.logger.warn(
          `Intraday sync failed for ${target.symbol}: ${String(error)}`,
        );
        this.tracking.warning(jobRunId, 'instruments', {
          instrumentId: target.instrumentId,
          symbol: target.symbol,
          code: 'intraday_fetch_failed',
        });
      }
    }
    this.tracking.completeStage(jobRunId, 'instruments', 'completed', {
      completed: instruments,
      total: targets.length,
      rowsWritten,
    });
    this.tracking.enterStage(jobRunId, 'finalize');
    const result = { instruments, rowsWritten, date: today };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    this.tracking.completeStage(jobRunId, 'finalize', 'completed', {
      instruments,
      rowsWritten,
    });
    return result;
  }

  async historicalFinalize(jobRunId: string, payload: Record<string, unknown>) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
    });
    const client = this.client(jobRunId);
    const reason = client.configurationReason();
    if (reason) {
      const result = { skipped: true, reason };
      this.tracking.completeStage(jobRunId, 'prepare', 'skipped', { reason: 'not_configured' });
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
      this.tracking.completeStage(jobRunId, 'prepare', 'skipped', { reason: 'no_completed_session' });
      await updateJobRun(jobRunId, {
        status: 'succeeded',
        finishedAt: new Date(),
        result,
      });
      return result;
    }
    const dates = await this.finalizeDates(latest, Boolean(payload.catchUp));
    const targets = await getSyncTargetInstruments();
    let instruments = 0;
    let rowsWritten = 0;
    let repairs = 0;
    const totalRepairs = targets.length * dates.length;
    this.tracking.completeStage(jobRunId, 'prepare', 'completed', {
      instruments: targets.length,
      dates: dates.length,
    });
    this.tracking.enterStage(jobRunId, 'repair');
    for (const target of targets) {
      const mapping = await findProviderMapping(
        target.instrumentId,
        provider.id,
      );
      if (!mapping) continue;
      for (const date of dates) {
        try {
          const result = await this.runChunk({
            jobRunId,
            providerId: provider.id,
            instrumentId: target.instrumentId,
            externalKey: mapping.externalKey,
            from: date,
            to: date,
            chunkIndex: dates.indexOf(date),
            chunkCount: dates.length,
            mode: 'force',
          });
          rowsWritten += result.written;
          await this.quality.recomputeCoverage(target.instrumentId, date, date);
          await this.quality.recomputeInstrumentStatus(target.instrumentId);
          instruments += 1;
          repairs += 1;
          this.tracking.progress(jobRunId, 'repair', {
            index: repairs,
            total: totalRepairs,
            instrumentId: target.instrumentId,
            symbol: target.symbol,
            tradingDate: date,
            written: result.written,
          });
        } catch (error) {
          const classification = classifyUpstoxError(error);
          const fatal = ['reference', 'auth', 'permission', 'contract'].includes(
            classification.kind,
          );
          await this.issue({
            ruleId: 'DQ-026',
            severity: fatal ? 'critical' : 'warning',
            providerId: provider.id,
            instrumentId: target.instrumentId,
            source: 'ingestion',
            scope: { from: date, to: date },
            payload: {
              from: date,
              to: date,
              error: {
                kind: classification.kind,
                code: classification.errorCode,
                message: classification.message,
                retryable: classification.retryable,
                retryAfterSeconds: classification.retryAfterSeconds,
                attempts: this.config.get<number>('UPSTOX_MAX_ATTEMPTS', 5),
              },
            },
          });
          this.tracking.warning(jobRunId, 'repair', {
            instrumentId: target.instrumentId,
            symbol: target.symbol,
            tradingDate: date,
            code: classification.kind,
            retryable: classification.retryable,
          });
        }
      }
    }
    this.tracking.completeStage(jobRunId, 'repair', 'completed', {
      completed: repairs,
      total: totalRepairs,
      rowsWritten,
    });
    this.tracking.enterStage(jobRunId, 'refresh');
    await refreshDailyStats();
    const result = { instruments, rowsWritten, dates };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    this.tracking.completeStage(jobRunId, 'refresh', 'completed', { rowsWritten });
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
    const targets =
      requestedIds.length > 0
        ? requestedIds.map((id) => ({ instrumentId: id }))
        : instrumentId
          ? [{ instrumentId }]
          : await getSyncTargetInstruments();
    let recomputed = 0;
    this.tracking.completeStage(jobRunId, 'prepare', 'completed', {
      instruments: targets.length,
      from,
      to,
    });
    this.tracking.enterStage(jobRunId, 'instruments');
    for (const target of targets) {
      await this.quality.recomputeCoverage(target.instrumentId, from, to);
      await this.quality.recomputeInstrumentStatus(target.instrumentId);
      recomputed += 1;
      this.tracking.progress(jobRunId, 'instruments', {
        index: recomputed,
        total: targets.length,
        instrumentId: target.instrumentId,
      });
    }
    this.tracking.completeStage(jobRunId, 'instruments', 'completed', {
      completed: recomputed,
      total: targets.length,
    });
    this.tracking.enterStage(jobRunId, 'finalize');
    const result = { recomputed, from, to };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    this.tracking.completeStage(jobRunId, 'finalize', 'completed', { recomputed });
    return result;
  }

  async coverageRebuild(jobRunId: string, payload: Record<string, unknown>) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
    });
    const latest =
      (await getLatestCompletedSession()) ??
      (typeof payload.to === 'string' ? payload.to : istToday());
    const from =
      typeof payload.from === 'string' ? payload.from : HISTORY_START;

    await deleteAllCoverage();
    this.tracking.completeStage(jobRunId, 'clear', 'completed');
    this.tracking.enterStage(jobRunId, 'instruments');
    const targets = await getSyncTargetInstruments();
    let rebuilt = 0;
    for (const target of targets) {
      await this.quality.recomputeCoverage(target.instrumentId, from, latest);
      await this.quality.recomputeInstrumentStatus(target.instrumentId);
      rebuilt += 1;
      this.tracking.progress(jobRunId, 'instruments', {
        index: rebuilt,
        total: targets.length,
        instrumentId: target.instrumentId,
      });
    }
    this.tracking.completeStage(jobRunId, 'instruments', 'completed', {
      completed: rebuilt,
      total: targets.length,
    });
    this.tracking.enterStage(jobRunId, 'finalize');

    const result = { rebuilt, from, to: latest };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    this.tracking.completeStage(jobRunId, 'finalize', 'completed', { rebuilt });
    return result;
  }

  async qualityScanJob(jobRunId: string, payload: Record<string, unknown>) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
    });
    const days = payload.days ? Number(payload.days) : 10;
    this.tracking.progress(jobRunId, 'scan', {
      index: 0,
      total: days,
      mode: payload.full === true ? 'full' : 'window',
    });
    const result = await this.quality.qualityScan({
      days,
      full: payload.full === true,
    });
    this.tracking.completeStage(jobRunId, 'scan', 'completed', {
      completed: days,
      total: days,
      scanned: result.scanned,
    });
    this.tracking.enterStage(jobRunId, 'stale');
    const stale = await this.quality.detectStaleIngestion();
    this.tracking.completeStage(jobRunId, 'stale', 'completed', { stale });
    this.tracking.enterStage(jobRunId, 'finalize');
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result: { ...result, stale },
    });
    this.tracking.completeStage(jobRunId, 'finalize', 'completed', {
      scanned: result.scanned,
      stale,
    });
    return result;
  }

  async ingestionReconcile(jobRunId: string) {
    await updateJobRun(jobRunId, {
      status: 'running',
      startedAt: new Date(),
    });

    await clearSystemIssues({ sources: ['reconciliation'], kinds: ['stale_job'] });

    const heartbeatExpired = await markStaleJobsFailed(15);
    const abandoned = await this.staleJobs.sweepQueued(15);
    const recovered = [
      ...heartbeatExpired.map((job) => ({
        jobRunId: job.id,
        jobName: job.jobName,
        instrumentId: job.instrumentId ?? null,
        severity: 'warning' as const,
        payload: {
          reason: 'running_job_heartbeat_expired',
          jobRunId: job.id,
          jobName: job.jobName,
          startedAt: job.startedAt?.toISOString() ?? null,
        },
      })),
      ...abandoned.map((job) => ({
        jobRunId: job.id,
        jobName: job.jobName,
        instrumentId: job.instrumentId,
        severity:
          job.status === 'succeeded' ? ('info' as const) : ('warning' as const),
        payload: {
          reason:
            job.status === 'succeeded'
              ? 'queued_job_ledger_reconciled'
              : 'queued_job_never_started',
          jobRunId: job.id,
          jobName: job.jobName,
          queueState: job.queueState,
          createdAt: job.createdAt.toISOString(),
        },
      })),
    ];

    const refreshed = [
      ...new Set(
        recovered
          .map((run) => run.instrumentId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    for (const [index, instrumentId] of refreshed.entries()) {
      await this.quality.recomputeInstrumentStatus(instrumentId);
      this.tracking.progress(jobRunId, 'sweep', {
        index: index + 1,
        total: refreshed.length,
        instrumentId,
      });
    }
    this.tracking.completeStage(jobRunId, 'sweep', 'completed', {
      completed: recovered.length,
      total: recovered.length,
      running: heartbeatExpired.length,
      queued: abandoned.length,
      refreshed: refreshed.length,
    });

    this.tracking.enterStage(jobRunId, 'issues');
    for (const [index, run] of recovered.entries()) {
      await this.issue({
        ruleId: 'DQ-023',
        severity: run.severity,
        providerId: null,
        instrumentId: run.instrumentId,
        source: 'reconciliation',
        scope: { jobRunId: run.jobRunId },
        payload: run.payload,
      });
      this.tracking.progress(jobRunId, 'issues', {
        index: index + 1,
        total: recovered.length,
        jobRunId: run.jobRunId,
        jobName: run.jobName,
      });
    }
    this.tracking.completeStage(jobRunId, 'issues', 'completed', {
      completed: recovered.length,
      total: recovered.length,
    });

    this.tracking.enterStage(jobRunId, 'finalize');
    const result = {
      recovered: recovered.length,
      running: heartbeatExpired.length,
      queued: abandoned.length,
      refreshed: refreshed.length,
    };
    await updateJobRun(jobRunId, {
      status: 'succeeded',
      finishedAt: new Date(),
      result,
    });
    this.tracking.completeStage(jobRunId, 'finalize', 'completed', result);
    return result;
  }
}
