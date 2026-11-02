import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UpstoxClient,
  parseCandleEnvelope,
  type UpstoxCandleResponse,
} from '@ai-trading/adapters';
import { sha256Hex } from '@ai-trading/domain';
import {
  buildSessionWindow,
  computeCoverageVerdict,
  eachDate,
  deriveDataStatusWithValidation,
  deriveFetchStatus,
  gapSeverity,
  istToday,
  istTradingDate,
  parseCandleTimestamp,
  qualityFinding,
  qualityRule,
  type CalendarSessionRow,
  type DailyCandleValues,
  type SessionWindow,
} from '@ai-trading/market-data';
import {
  autoResolveStaleIssues,
  createRawProviderPayload,
  findActiveBackfillRun,
  findProviderByCode,
  getCandleUpdatedAt,
  getCoverageInputs,
  getDailyAggregatesFromMinutes,
  getDailyValidationsForRange,
  getDailyValidation,
  getExistingCandles,
  getInstrumentListing,
  getInstrumentStatusCounters,
  hasConfirmedCorporateAction,
  getInstrumentStatusRow,
  getInstrumentTickSize,
  getLastSuccessfulRunForInstrument,
  getLatestCompletedSession,
  getLatestRunForInstrument,
  getMinuteAggregate,
  getPrimaryMappingCount,
  getStoredCandleStarts,
  getTradingSessionsForRange,
  getUniverseMembersForBackfill,
  upsertCoverageBatch,
  upsertDailyValidation,
  upsertInstrumentStatus,
  upsertQualityIssue,
} from '@ai-trading/database';

@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);

  constructor(private readonly config: ConfigService) {}

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
    const result = new Map<string, SessionWindow>();
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
      if (session) result.set(row.trading_date, session);
    }
    return result;
  }

  async recomputeCoverage(instrumentId: string, from: string, to: string) {
    const provider = await findProviderByCode('upstox');
    if (!provider) throw new Error('Upstox provider is not seeded');
    const sessions = await this.sessions(from, to);
    const tickSize = Number(await getInstrumentTickSize(instrumentId));
    const listing = await getInstrumentListing(instrumentId);
    const volumeTolerance = this.config.get<number>(
      'DATA_QUALITY_VOLUME_TOLERANCE_PCT',
      0.02,
    );
    const maxGap = this.config.get<number>('DATA_QUALITY_MAX_GAP_MINUTES', 5);
    const inputs = new Map(
      (await getCoverageInputs(instrumentId, from, to)).map((row) => [
        row.trading_date,
        row,
      ]),
    );
    const validations = new Map(
      (await getDailyValidationsForRange(instrumentId, from, to)).map((row) => [
        row.tradingDate,
        row,
      ]),
    );

    let complete = 0;
    let partial = 0;
    let missing = 0;
    let notApplicable = 0;
    const rows: Parameters<typeof upsertCoverageBatch>[0] = [];

    for (const date of eachDate(from, to)) {
      const session = sessions.get(date) ?? null;
      if (!session) {
        rows.push({
          instrumentId,
          tradingDate: date,
          expectedBars: 0,
          storedBars: 0,
          gapCount: 0,
          gapRunCount: 0,
          maxGapMinutes: 0,
          firstBarAt: null,
          lastBarAt: null,
          status: 'not_applicable',
          validationStatus: 'not_checked',
          details: { reason: 'not a scheduled trading session' },
        });
        notApplicable += 1;
        continue;
      }
      if (
        (listing?.listedOn && date < listing.listedOn) ||
        (listing?.delistedOn && date > listing.delistedOn)
      ) {
        rows.push({
          instrumentId,
          tradingDate: date,
          expectedBars: 0,
          storedBars: 0,
          gapCount: 0,
          gapRunCount: 0,
          maxGapMinutes: 0,
          firstBarAt: null,
          lastBarAt: null,
          status: 'not_applicable',
          validationStatus: 'not_checked',
          details: {
            reason: 'outside the reviewed listing window',
            listedOn: listing.listedOn,
            delistedOn: listing.delistedOn,
          },
        });
        notApplicable += 1;
        continue;
      }

      const input = inputs.get(date);
      const observed = (input?.starts ?? []).map((value) =>
        value instanceof Date ? value : new Date(value),
      );
      const stored = observed.map((candleStart, index) => ({
        candleStart,
        volume: '0',
        isFinal: !(input?.has_partial && index === observed.length - 1),
      }));
      const validation = validations.get(date);
      const daily =
        validation &&
        validation.dailyOpen &&
        validation.dailyHigh &&
        validation.dailyLow &&
        validation.dailyClose &&
        validation.dailyVolume
          ? {
              open: validation.dailyOpen,
              high: validation.dailyHigh,
              low: validation.dailyLow,
              close: validation.dailyClose,
              volume: validation.dailyVolume,
            }
          : null;
      const minute = {
        open: input?.minute_open ?? null,
        high: input?.minute_high ?? null,
        low: input?.minute_low ?? null,
        close: input?.minute_close ?? null,
        volume: input?.minute_volume ?? '0',
        bars: input?.stored_bars ?? 0,
      };
      const verdict = computeCoverageVerdict({
        session,
        observed,
        daily,
        minute,
        tickSize,
        volumeTolerancePct: volumeTolerance,
        hasCriticalIssue: false,
      });

      rows.push({
        instrumentId,
        tradingDate: date,
        expectedBars: verdict.expectedBars,
        storedBars: verdict.storedBars,
        gapCount: verdict.missingBarCount,
        gapRunCount: verdict.gapRunCount,
        maxGapMinutes: verdict.maxGapMinutes,
        firstBarAt: verdict.firstBarAt,
        lastBarAt: verdict.lastBarAt,
        status: verdict.status,
        dailyVolume: validation?.dailyVolume ?? null,
        minuteVolume: input?.minute_volume ?? null,
        volumeDeltaPct: validation?.volumeDeltaPct ?? null,
        ohlcMatch: validation?.ohlcMatch ?? null,
        validationStatus: verdict.validationStatus,
        details: verdict.details,
      });

      if (verdict.status === 'complete') complete += 1;
      else if (verdict.status === 'partial') partial += 1;
      else missing += 1;

      await this.coverageIssues({
        instrumentId,
        providerId: provider.id,
        date,
        session,
        verdict,
        stored,
        validation: validation ?? null,
        maxGap,
      });
    }

    await upsertCoverageBatch(rows);
    return {
      complete,
      partial,
      missing,
      notApplicable,
      datesChecked: rows.length,
    };
  }

  private async coverageIssues(input: {
    instrumentId: string;
    providerId: string;
    date: string;
    session: SessionWindow;
    verdict: Awaited<ReturnType<typeof computeCoverageVerdict>>;
    stored: Awaited<ReturnType<typeof getStoredCandleStarts>>;
    validation: Awaited<ReturnType<typeof getDailyValidation>> | null;
    maxGap: number;
  }): Promise<void> {
    const {
      instrumentId,
      providerId,
      date,
      session,
      verdict,
      stored,
      validation,
      maxGap,
    } = input;
    const base = {
      providerId,
      instrumentId,
      tradingDate: date,
      windowStart: session.open,
      windowEnd: session.close,
      detectedBy: 'validation' as const,
    };

    if (verdict.status === 'missing') {
      await this.issue({
        ...base,
        ruleId: 'DQ-003',
        severity: 'critical',
        details: { expectedBars: verdict.expectedBars, storedBars: 0 },
      });
    }
    if (verdict.missingBarCount > 0) {
      await this.issue({
        ...base,
        ruleId: 'DQ-001',
        severity: 'warning',
        details: {
          missingBarCount: verdict.missingBarCount,
          sample: (verdict.details.missingSample as string[] | undefined) ?? [],
        },
      });
    }
    if (verdict.gapRunCount > 0) {
      const runs =
        (verdict.details.gapRuns as
          { start: string; end: string; minutes: number }[] | undefined) ?? [];
      const critical = runs.some(
        (run) =>
          gapSeverity({
            tradingDate: date,
            gapStart: new Date(run.start),
            gapMinutes: run.minutes,
            volumeReconciled: verdict.validationStatus === 'volume_reconciled',
            maxAcceptedGapMinutes: maxGap,
          }) === 'critical',
      );
      await this.issue({
        ...base,
        ruleId: 'DQ-002',
        severity: critical ? 'critical' : 'warning',
        details: {
          gapRunCount: verdict.gapRunCount,
          maxGapMinutes: verdict.maxGapMinutes,
          runs,
        },
      });
    }
    if (verdict.details.missingOpen || verdict.details.missingClose) {
      await this.issue({
        ...base,
        ruleId: 'DQ-006',
        severity: 'warning',
        details: {
          missingOpen: verdict.details.missingOpen,
          missingClose: verdict.details.missingClose,
        },
      });
    }
    if (stored.some((row) => !row.isFinal)) {
      await this.issue({
        ...base,
        ruleId: 'DQ-004',
        severity: 'info',
        details: { partialBars: stored.filter((row) => !row.isFinal).length },
      });
    }
    if (stored.length > 0) {
      const first = stored[0]!.candleStart;
      const last = stored[stored.length - 1]!.candleStart;
      if (first < session.open || last >= session.close) {
        await this.issue({
          ...base,
          ruleId: 'DQ-005',
          severity: 'critical',
          details: {
            firstBarAt: first.toISOString(),
            lastBarAt: last.toISOString(),
          },
        });
      }
    }

    if (verdict.validationStatus === 'volume_mismatch') {
      const daily = Number(validation?.dailyVolume ?? 0);
      const minute = Number(validation?.minuteVolume ?? 0);
      await this.issue({
        ...base,
        ruleId: 'DQ-012',
        severity: minute < daily ? 'critical' : 'warning',
        details: {
          dailyVolume: validation?.dailyVolume,
          minuteVolume: validation?.minuteVolume,
        },
      });
    }
    if (verdict.validationStatus === 'volume_reconciled') {
      await this.issue({
        ...base,
        ruleId: 'DQ-013',
        severity: 'info',
        details: {
          missingBarCount: verdict.missingBarCount,
          dailyVolume: validation?.dailyVolume,
        },
      });
    }
    if (verdict.validationStatus === 'ohlc_mismatch') {
      await this.issue({
        ...base,
        ruleId: 'DQ-014',
        severity: 'warning',
        details: validation?.id ? { validationId: validation.id } : {},
      });
    }
    if (
      verdict.validationStatus === 'daily_missing' ||
      verdict.validationStatus === 'minute_missing'
    ) {
      await this.issue({
        ...base,
        ruleId: 'DQ-016',
        severity: 'critical',
        details: { validationStatus: verdict.validationStatus },
      });
    }
  }

  async recomputeInstrumentStatus(instrumentId: string) {
    const latestSession = await getLatestCompletedSession();
    const statusRow = await getInstrumentStatusRow(instrumentId);
    const targetFrom = statusRow?.targetFrom ?? '2022-01-01';
    const targetTo = latestSession ?? statusRow?.targetTo ?? istToday();
    const counters = await getInstrumentStatusCounters(
      instrumentId,
      targetFrom,
      targetTo,
    );
    const latestRun = await getLatestRunForInstrument(instrumentId);
    const activeRun = await findActiveBackfillRun(instrumentId);
    const lastSuccess = await getLastSuccessfulRunForInstrument(instrumentId);
    const staleSessions = this.config.get<number>(
      'DATA_STATUS_STALE_SESSIONS',
      1,
    );
    const stale =
      !lastSuccess ||
      (latestSession !== null &&
        latestSession > targetTo &&
        Math.round(
          (new Date(`${latestSession}T00:00:00Z`).getTime() -
            new Date(`${targetTo}T00:00:00Z`).getTime()) /
            86_400_000,
        ) >= staleSessions);

    const dataStatus = deriveDataStatusWithValidation({
      counters: {
        expectedDays: counters.expectedDays,
        completeDays: counters.completeDays,
        partialDays: counters.partialDays,
        missingDays: counters.missingDays,
        notApplicableDays: counters.notApplicableDays,
        openCriticalIssues: counters.openCriticalIssues,
      },
      reconciledDays: counters.reconciledDays,
      mismatchDays: counters.mismatchDays,
    });
    const fetchStatus = deriveFetchStatus({
      hasRun: Boolean(latestRun),
      queued: latestRun?.status === 'queued' ? 1 : 0,
      running: latestRun?.status === 'running' ? 1 : 0,
      lastStatus: latestRun?.status ?? null,
      stale: dataStatus === 'complete' && stale,
    });

    return upsertInstrumentStatus({
      instrumentId,
      targetFrom,
      targetTo,
      fetchStatus,
      dataStatus,
      expectedDays: counters.expectedDays,
      completeDays: counters.completeDays,
      partialDays: counters.partialDays,
      missingDays: counters.missingDays,
      notApplicableDays: counters.notApplicableDays,
      openCriticalIssues: counters.openCriticalIssues,
      lastRunId: latestRun?.id ?? null,
      activeRunId: activeRun?.id ?? null,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      computedAt: new Date(),
    });
  }

  async fetchDailyOracle(
    instrumentId: string,
    externalKey: string,
    from: string,
    to: string,
  ) {
    const client = this.client();
    const provider = await findProviderByCode('upstox');
    if (!provider || client.configurationReason()) return null;
    const response: UpstoxCandleResponse = await client.fetchDailyCandles({
      instrumentKey: externalKey,
      from,
      to,
    });
    const serialized = JSON.stringify(response);
    const raw = await createRawProviderPayload({
      providerId: provider.id,
      endpoint: '/v3/historical-candle/:instrument_key/days/1/:to/:from',
      httpMethod: 'GET',
      requestFingerprint: sha256Hex(`daily|${externalKey}|${from}|${to}`),
      requestParams: {
        instrumentKey: externalKey,
        from,
        to,
        unit: 'days',
        interval: 1,
      },
      httpStatus: 200,
      contentEncoding: null,
      payload: response,
      payloadBytes: Buffer.byteLength(serialized, 'utf8'),
      payloadSha256: sha256Hex(serialized),
      retentionClass: 'extended',
      expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
    });
    const parsed = parseCandleEnvelope(response);
    const byDate = new Map<string, DailyCandleValues>();
    for (const [timestamp, open, high, low, close, volume] of parsed.data
      .candles) {
      const date = istTradingDate(parseCandleTimestamp(timestamp));
      byDate.set(date, {
        open: String(open),
        high: String(high),
        low: String(low),
        close: String(close),
        volume: String(volume),
      });
    }
    return { providerId: provider.id, rawPayloadId: raw.id, byDate };
  }

  async validateDaily(
    instrumentId: string,
    externalKey: string,
    from: string,
    to: string,
    ingestionRunId: string | null,
  ) {
    const oracle = await this.fetchDailyOracle(
      instrumentId,
      externalKey,
      from,
      to,
    );
    if (!oracle) return { skipped: true, reason: 'provider not configured' };
    const sessions = await this.sessions(from, to);
    let matched = 0;
    let reconciled = 0;
    let mismatch = 0;
    let missing = 0;
    for (const [date, session] of sessions) {
      const daily = oracle.byDate.get(date) ?? null;
      const aggregate = await getMinuteAggregate(instrumentId, date);
      const minute = {
        open: aggregate.open,
        high: aggregate.high,
        low: aggregate.low,
        close: aggregate.close,
        volume: aggregate.volume ?? '0',
        bars: aggregate.bars,
      };
      const verdict = computeCoverageVerdict({
        session,
        observed: (await getStoredCandleStarts(instrumentId, date)).map(
          (row) => row.candleStart,
        ),
        daily,
        minute,
        tickSize: Number(await getInstrumentTickSize(instrumentId)),
        volumeTolerancePct: this.config.get<number>(
          'DATA_QUALITY_VOLUME_TOLERANCE_PCT',
          0.02,
        ),
        hasCriticalIssue: false,
      });
      const status =
        verdict.validationStatus === 'matched' && verdict.missingBarCount > 0
          ? 'volume_reconciled'
          : verdict.validationStatus;
      const dailyVolume = Number(daily?.volume ?? 0);
      const minuteVolume = Number(minute.volume ?? 0);
      const volumeDeltaPct =
        dailyVolume === 0
          ? null
          : ((minuteVolume - dailyVolume) / dailyVolume).toFixed(10);
      await upsertDailyValidation({
        instrumentId,
        tradingDate: date,
        sourceProviderId: oracle.providerId,
        dailyOpen: daily?.open ?? null,
        dailyHigh: daily?.high ?? null,
        dailyLow: daily?.low ?? null,
        dailyClose: daily?.close ?? null,
        dailyVolume: daily?.volume ?? null,
        minuteOpen: minute.open,
        minuteHigh: minute.high,
        minuteLow: minute.low,
        minuteClose: minute.close,
        minuteVolume: minute.volume,
        volumeDeltaPct,
        ohlcMatch:
          verdict.validationStatus === 'matched' ||
          status === 'volume_reconciled',
        volumeMatch:
          verdict.validationStatus === 'matched' ||
          status === 'volume_reconciled',
        status,
        ingestionRunId,
        rawPayloadId: oracle.rawPayloadId,
      });
      if (status === 'matched') matched += 1;
      else if (status === 'volume_reconciled') reconciled += 1;
      else if (status === 'daily_missing' || status === 'minute_missing')
        missing += 1;
      else mismatch += 1;
    }
    return { skipped: false, matched, reconciled, mismatch, missing };
  }

  async qualityScan(options: { days?: number; full?: boolean } = {}) {
    const provider = await findProviderByCode('upstox');
    if (!provider) throw new Error('Upstox provider is not seeded');
    const latest = (await getLatestCompletedSession()) ?? istToday();
    const days = options.full ? 1100 : (options.days ?? 10);
    const from = new Date(`${latest}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - days);
    const fromDate = from.toISOString().slice(0, 10);
    const members = await getUniverseMembersForBackfill('nifty-50');

    let scanned = 0;
    for (const member of members) {
      await this.recomputeCoverage(member.instrumentId, fromDate, latest);
      await this.recomputeInstrumentStatus(member.instrumentId);
      await this.detectCorporateActionMismatch(
        member.instrumentId,
        fromDate,
        latest,
      );
      await this.detectCoverageAge(member.instrumentId, latest);
      scanned += 1;
    }
    await this.detectDuplicateMappings(provider.id);
    const autoResolved = await autoResolveStaleIssues(
      this.config.get<number>('DATA_QUALITY_STALE_HOURS', 24),
    );
    return { scanned, from: fromDate, to: latest, autoResolved };
  }

  async detectCorporateActionMismatch(
    instrumentId: string,
    from: string,
    to: string,
  ) {
    const provider = await findProviderByCode('upstox');
    if (!provider) return 0;
    const rows = await getDailyAggregatesFromMinutes(instrumentId, from, to);
    let findings = 0;
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1]!;
      const current = rows[index]!;
      const previousClose = Number(previous.close);
      const open = Number(current.open);
      if (
        !Number.isFinite(previousClose) ||
        !Number.isFinite(open) ||
        previousClose <= 0
      )
        continue;
      const ratio = Math.abs(open / previousClose - 1);
      if (ratio <= 0.05) continue;
      if (
        await hasConfirmedCorporateAction(instrumentId, current.trading_date)
      ) {
        continue;
      }
      await this.issue({
        ruleId: 'DQ-020',
        severity: 'critical',
        providerId: provider.id,
        instrumentId,
        tradingDate: current.trading_date,
        windowStart: null,
        windowEnd: null,
        details: {
          previousClose,
          open,
          impliedFactor: open / previousClose,
          previousDate: previous.trading_date,
          note: 'Confirm or dismiss the corporate action before the backtest preflight.',
        },
        detectedBy: 'reconciliation',
      });
      findings += 1;
    }
    return findings;
  }

  async detectDuplicateMappings(providerId: string) {
    const members = await getUniverseMembersForBackfill('nifty-50');
    let findings = 0;
    for (const member of members) {
      const count = await getPrimaryMappingCount(
        member.instrumentId,
        providerId,
      );
      if (count > 1) {
        await this.issue({
          ruleId: 'DQ-025',
          severity: 'warning',
          providerId,
          instrumentId: member.instrumentId,
          tradingDate: null,
          windowStart: null,
          windowEnd: null,
          details: { primaryMappings: count },
          detectedBy: 'reconciliation',
        });
        findings += 1;
      }
    }
    return findings;
  }

  async detectCoverageAge(instrumentId: string, date: string) {
    const provider = await findProviderByCode('upstox');
    if (!provider) return false;
    const coverage = await getDailyValidation(instrumentId, date);
    void coverage;
    const candleUpdatedAt = await getCandleUpdatedAt(instrumentId, date);
    if (!candleUpdatedAt) return false;
    const statusRow = await getInstrumentStatusRow(instrumentId);
    if (statusRow?.computedAt && statusRow.computedAt >= candleUpdatedAt)
      return false;
    await this.issue({
      ruleId: 'DQ-024',
      severity: 'info',
      providerId: provider.id,
      instrumentId,
      tradingDate: date,
      windowStart: null,
      windowEnd: null,
      details: {
        candleUpdatedAt: candleUpdatedAt.toISOString(),
        computedAt: statusRow?.computedAt?.toISOString() ?? null,
      },
      detectedBy: 'reconciliation',
    });
    return true;
  }

  async detectStaleIngestion() {
    const provider = await findProviderByCode('upstox');
    if (!provider) return 0;
    const members = await getUniverseMembersForBackfill('nifty-50');
    const staleHours = this.config.get<number>('DATA_QUALITY_STALE_HOURS', 24);
    let findings = 0;
    for (const member of members) {
      const lastSuccess = await getLastSuccessfulRunForInstrument(
        member.instrumentId,
      );
      if (!lastSuccess?.finishedAt) {
        await this.issue({
          ruleId: 'DQ-021',
          severity: 'warning',
          providerId: provider.id,
          instrumentId: member.instrumentId,
          tradingDate: null,
          windowStart: null,
          windowEnd: null,
          details: { reason: 'no successful ingestion' },
          detectedBy: 'reconciliation',
        });
        findings += 1;
        continue;
      }
      const ageHours =
        (Date.now() - lastSuccess.finishedAt.getTime()) / 3_600_000;
      if (ageHours > staleHours) {
        await this.issue({
          ruleId: 'DQ-021',
          severity: 'warning',
          providerId: provider.id,
          instrumentId: member.instrumentId,
          tradingDate: null,
          windowStart: null,
          windowEnd: null,
          details: {
            ageHours: Math.round(ageHours),
            lastSuccessAt: lastSuccess.finishedAt.toISOString(),
          },
          detectedBy: 'reconciliation',
        });
        findings += 1;
      }
    }
    return findings;
  }

  async detectTickAlignment(instrumentId: string, from: string, to: string) {
    const provider = await findProviderByCode('upstox');
    if (!provider) return 0;
    const tick = Number(await getInstrumentTickSize(instrumentId));
    if (!(tick > 0)) return 0;
    const candles = await getExistingCandles(
      instrumentId,
      new Date(`${from}T00:00:00Z`),
      new Date(`${to}T23:59:59Z`),
    );
    let misaligned = 0;
    for (const candle of candles) {
      for (const value of [
        candle.open,
        candle.high,
        candle.low,
        candle.close,
      ]) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) continue;
        const remainder = Math.abs(Math.round(numeric / tick) * tick - numeric);
        if (remainder > 1e-6) {
          misaligned += 1;
          break;
        }
      }
    }
    if (misaligned > 0) {
      await this.issue({
        ruleId: 'DQ-011',
        severity: 'warning',
        providerId: provider.id,
        instrumentId,
        tradingDate: null,
        windowStart: null,
        windowEnd: null,
        details: { misalignedBars: misaligned, tickSize: tick },
        detectedBy: 'validation',
      });
    }
    return misaligned;
  }
}
