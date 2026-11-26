import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildSessionWindow,
  computeCoverageVerdict,
  eachDate,
  deriveDataStatus,
  fetchStatusFromRun,
  gapSeverity,
  istToday,
  type CalendarSessionRow,
  type SessionWindow,
} from '@ai-trading/market-data';
import {
  clearSystemIssues,
  findProviderByCode,
  getCandleUpdatedAt,
  getCoverageInputs,
  getDailyAggregatesFromMinutes,
  getExistingCandles,
  getInstrumentListing,
  getInstrumentStatusCounters,
  hasConfirmedCorporateAction,
  getInstrumentStatusRow,
  getInstrumentTickSize,
  getLastSuccessfulJobForInstrument,
  getLatestBackfillJobForInstrument,
  getLatestCompletedSession,
  getPrimaryMappingCount,
  getSyncTargetInstruments,
  getTradingSessionsForRange,
  upsertCoverageBatch,
  upsertInstrumentStatus,
} from '@ai-trading/database';
import { recordIssue } from './issue-recorder.js';

@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);

  constructor(private readonly config: ConfigService) {}

  private issue(values: Parameters<typeof recordIssue>[0]): Promise<void> {
    return recordIssue(values);
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
        sessionBreaks: row.session_breaks ?? [],
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
    const listing = await getInstrumentListing(instrumentId);
    const maxGap = this.config.get<number>('DATA_QUALITY_MAX_GAP_MINUTES', 5);
    const inputs = new Map(
      (await getCoverageInputs(instrumentId, from, to)).map((row) => [
        row.trading_date,
        row,
      ]),
    );

    let complete = 0;
    let partial = 0;
    let missing = 0;
    const rows: Parameters<typeof upsertCoverageBatch>[0] = [];

    for (const date of eachDate(from, to)) {
      const session = sessions.get(date);
      if (!session) continue;
      if (
        (listing?.listedOn && date < listing.listedOn) ||
        (listing?.delistedOn && date > listing.delistedOn)
      ) {
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
      const verdict = computeCoverageVerdict({ session, observed });

      rows.push({
        instrumentId,
        tradingDate: date,
        expectedBars: verdict.expectedBars,
        storedBars: verdict.storedBars,
        checkedAt: new Date(),
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
        maxGap,
      });
    }

    await upsertCoverageBatch(rows);
    return {
      complete,
      partial,
      missing,
      datesChecked: rows.length,
    };
  }

  private async coverageIssues(input: {
    instrumentId: string;
    providerId: string;
    date: string;
    session: SessionWindow;
    verdict: Awaited<ReturnType<typeof computeCoverageVerdict>>;
    stored: { candleStart: Date; volume: string; isFinal: boolean }[];
    maxGap: number;
  }): Promise<void> {
    const { instrumentId, providerId, date, session, verdict, stored, maxGap } = input;

    // A recheck rebuilds the day's findings: clear what this pass owns, then
    // raise whatever is still true.
    await clearSystemIssues({
      sources: ['validation'],
      kinds: ['missing_bar', 'gap', 'coverage_shortfall', 'calendar_mismatch', 'partial_bar'],
      instrumentId,
      tradingDate: date,
    });

    const scope = {
      tradingDate: date,
      windowStart: session.open.toISOString(),
      windowEnd: session.close.toISOString(),
    };
    const base = {
      providerId,
      instrumentId,
      source: 'validation' as const,
      scope,
    };
    const payload = {
      tradingDate: date,
      windowStart: session.open.toISOString(),
      windowEnd: session.close.toISOString(),
    };

    if (verdict.status === 'missing') {
      await this.issue({
        ...base,
        ruleId: 'DQ-003',
        severity: 'critical',
        payload: { ...payload, expectedBars: verdict.expectedBars, storedBars: 0 },
      });
    }
    if (verdict.missingBarCount > 0) {
      await this.issue({
        ...base,
        ruleId: 'DQ-001',
        severity: 'warning',
        payload: {
          ...payload,
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
            maxAcceptedGapMinutes: maxGap,
          }) === 'critical',
      );
      await this.issue({
        ...base,
        ruleId: 'DQ-002',
        severity: critical ? 'critical' : 'warning',
        payload: {
          ...payload,
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
        payload: {
          ...payload,
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
        payload: {
          ...payload,
          partialBars: stored.filter((row) => !row.isFinal).length,
        },
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
          payload: {
            ...payload,
            firstBarAt: first.toISOString(),
            lastBarAt: last.toISOString(),
          },
        });
      }
    }
  }

  /**
   * Rebuilds the catalog projection for one instrument. `excludeJobRunId` leaves a run out of the
   * evidence, which is how a skipped run releases the in-flight marker without claiming a fetch.
   */
  async recomputeInstrumentStatus(
    instrumentId: string,
    options: { excludeJobRunId?: string } = {},
  ) {
    const latestSession = await getLatestCompletedSession();
    const statusRow = await getInstrumentStatusRow(instrumentId);
    const targetFrom = statusRow?.targetFrom ?? '2022-01-01';
    const targetTo = latestSession ?? statusRow?.targetTo ?? istToday();
    const counters = await getInstrumentStatusCounters(
      instrumentId,
      targetFrom,
      targetTo,
    );
    const latestJob = await getLatestBackfillJobForInstrument(instrumentId, options);
    const lastSuccess = await getLastSuccessfulJobForInstrument(instrumentId, options);
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

    const listing = await getInstrumentListing(instrumentId);
    const expectsData =
      Boolean(listing) &&
      Boolean(listing?.isActive) &&
      (!listing?.delistedOn || listing.delistedOn >= targetFrom) &&
      (!listing?.listedOn || listing.listedOn <= targetTo);
    const dataStatus = deriveDataStatus(counters, expectsData);
    const fetchStatus = fetchStatusFromRun(latestJob, {
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
      openCriticalIssues: counters.openCriticalIssues,
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      computedAt: new Date(),
    });
  }

  async qualityScan(options: { days?: number; full?: boolean } = {}) {
    const provider = await findProviderByCode('upstox');
    if (!provider) throw new Error('Upstox provider is not seeded');
    const latest = (await getLatestCompletedSession()) ?? istToday();
    const days = options.full ? 1100 : (options.days ?? 10);
    const from = new Date(`${latest}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - days);
    const fromDate = from.toISOString().slice(0, 10);
    const targets = await getSyncTargetInstruments();

    let scanned = 0;
    for (const target of targets) {
      await this.recomputeCoverage(target.instrumentId, fromDate, latest);
      await this.recomputeInstrumentStatus(target.instrumentId);
      await this.detectCorporateActionMismatch(
        target.instrumentId,
        fromDate,
        latest,
      );
      await this.detectCoverageAge(target.instrumentId, latest);
      scanned += 1;
    }
    await this.detectDuplicateMappings(provider.id);
    return { scanned, from: fromDate, to: latest };
  }

  async detectCorporateActionMismatch(
    instrumentId: string,
    from: string,
    to: string,
  ) {
    const provider = await findProviderByCode('upstox');
    if (!provider) return 0;
    await clearSystemIssues({
      sources: ['reconciliation'],
      kinds: ['corporate_action_mismatch'],
      instrumentId,
    });
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
        source: 'reconciliation',
        scope: { tradingDate: current.trading_date },
        payload: {
          tradingDate: current.trading_date,
          previousClose,
          open,
          impliedFactor: open / previousClose,
          previousDate: previous.trading_date,
          note: 'Confirm or dismiss the corporate action before the backtest preflight.',
        },
      });
      findings += 1;
    }
    return findings;
  }

  async detectDuplicateMappings(providerId: string) {
    const targets = await getSyncTargetInstruments();
    let findings = 0;
    for (const target of targets) {
      await clearSystemIssues({
        sources: ['reconciliation'],
        kinds: ['duplicate_mapping'],
        instrumentId: target.instrumentId,
      });
      const count = await getPrimaryMappingCount(
        target.instrumentId,
        providerId,
      );
      if (count > 1) {
        await this.issue({
          ruleId: 'DQ-025',
          severity: 'warning',
          providerId,
          instrumentId: target.instrumentId,
          source: 'reconciliation',
          scope: {},
          payload: { primaryMappings: count },
        });
        findings += 1;
      }
    }
    return findings;
  }

  async detectCoverageAge(instrumentId: string, date: string) {
    const provider = await findProviderByCode('upstox');
    if (!provider) return false;
    const candleUpdatedAt = await getCandleUpdatedAt(instrumentId, date);
    if (!candleUpdatedAt) return false;
    const statusRow = await getInstrumentStatusRow(instrumentId);
    await clearSystemIssues({
      sources: ['reconciliation'],
      kinds: ['stale_coverage'],
      instrumentId,
      tradingDate: date,
    });
    if (statusRow?.computedAt && statusRow.computedAt >= candleUpdatedAt)
      return false;
    await this.issue({
      ruleId: 'DQ-024',
      severity: 'info',
      providerId: provider.id,
      instrumentId,
      source: 'reconciliation',
      scope: { tradingDate: date },
      payload: {
        tradingDate: date,
        candleUpdatedAt: candleUpdatedAt.toISOString(),
        computedAt: statusRow?.computedAt?.toISOString() ?? null,
      },
    });
    return true;
  }

  async detectStaleIngestion() {
    const provider = await findProviderByCode('upstox');
    if (!provider) return 0;
    const targets = await getSyncTargetInstruments();
    const staleHours = this.config.get<number>('DATA_QUALITY_STALE_HOURS', 24);
    let findings = 0;
    for (const target of targets) {
      await clearSystemIssues({
        sources: ['reconciliation'],
        kinds: ['stale_ingestion'],
        instrumentId: target.instrumentId,
      });
      const lastSuccess = await getLastSuccessfulJobForInstrument(
        target.instrumentId,
      );
      if (!lastSuccess?.finishedAt) {
        await this.issue({
          ruleId: 'DQ-021',
          severity: 'warning',
          providerId: provider.id,
          instrumentId: target.instrumentId,
          source: 'reconciliation',
          scope: {},
          payload: { reason: 'no successful ingestion' },
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
          instrumentId: target.instrumentId,
          source: 'reconciliation',
          scope: {},
          payload: {
            ageHours: Math.round(ageHours),
            lastSuccessAt: lastSuccess.finishedAt.toISOString(),
          },
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
    await clearSystemIssues({
      sources: ['validation'],
      kinds: ['tick_size_mismatch'],
      instrumentId,
    });
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
        source: 'validation',
        scope: {},
        payload: { misalignedBars: misaligned, tickSize: tick },
      });
    }
    return misaligned;
  }
}
