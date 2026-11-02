import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import { nseHolidays, nseSpecialSessions } from '../fixtures/nse.js';
import {
  corporateActions,
  dataQualityIssues,
  exchanges,
  instrumentDataStatus,
  instrumentProviderMappings,
  instrumentUniverseMembers,
  instrumentUniverseVersions,
  instrumentUniverses,
  instruments,
  marketDataCoverage,
  marketDataIngestionRuns,
  providers,
  rawProviderPayloads,
  tradingCalendar,
} from '../schema/index.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function listInstruments(filters: {
  search?: string;
  segment?: string;
  activeOnly?: boolean;
  limit?: number;
}) {
  const conditions = [];
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(instruments.tradingSymbol, term),
      ilike(instruments.name, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  if (filters.segment) conditions.push(eq(instruments.segment, filters.segment));
  if (filters.activeOnly !== false) conditions.push(eq(instruments.isActive, true));

  return db
    .select({
      id: instruments.id,
      exchangeId: instruments.exchangeId,
      exchangeCode: exchanges.code,
      tradingSymbol: instruments.tradingSymbol,
      name: instruments.name,
      shortName: instruments.shortName,
      isin: instruments.isin,
      segment: instruments.segment,
      instrumentType: instruments.instrumentType,
      lotSize: instruments.lotSize,
      tickSize: instruments.tickSize,
      freezeQuantity: instruments.freezeQuantity,
      isActive: instruments.isActive,
      listedOn: instruments.listedOn,
      delistedOn: instruments.delistedOn,
      mappingCount: sql<number>`(
        select count(*)::int from instrument_provider_mappings m
        where m.instrument_id = ${instruments.id}
      )`,
    })
    .from(instruments)
    .innerJoin(exchanges, eq(exchanges.id, instruments.exchangeId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(instruments.tradingSymbol))
    .limit(filters.limit ?? 200);
}

export async function getInstrument(id: string) {
  const rows = await db
    .select({
      id: instruments.id,
      exchangeId: instruments.exchangeId,
      exchangeCode: exchanges.code,
      tradingSymbol: instruments.tradingSymbol,
      name: instruments.name,
      shortName: instruments.shortName,
      isin: instruments.isin,
      segment: instruments.segment,
      instrumentType: instruments.instrumentType,
      lotSize: instruments.lotSize,
      tickSize: instruments.tickSize,
      freezeQuantity: instruments.freezeQuantity,
      isActive: instruments.isActive,
      listedOn: instruments.listedOn,
      delistedOn: instruments.delistedOn,
    })
    .from(instruments)
    .innerJoin(exchanges, eq(exchanges.id, instruments.exchangeId))
    .where(eq(instruments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listInstrumentMappings(instrumentId: string) {
  return db
    .select({
      id: instrumentProviderMappings.id,
      providerId: instrumentProviderMappings.providerId,
      providerCode: providers.code,
      providerName: providers.name,
      externalKey: instrumentProviderMappings.externalKey,
      exchangeToken: instrumentProviderMappings.exchangeToken,
      providerSymbol: instrumentProviderMappings.providerSymbol,
      providerSegment: instrumentProviderMappings.providerSegment,
      isPrimary: instrumentProviderMappings.isPrimary,
      validFrom: instrumentProviderMappings.validFrom,
      validTo: instrumentProviderMappings.validTo,
      rawPayloadId: instrumentProviderMappings.rawPayloadId,
    })
    .from(instrumentProviderMappings)
    .innerJoin(providers, eq(providers.id, instrumentProviderMappings.providerId))
    .where(eq(instrumentProviderMappings.instrumentId, instrumentId))
    .orderBy(desc(instrumentProviderMappings.validFrom));
}

export async function listCorporateActions(instrumentId?: string) {
  return db
    .select({
      id: corporateActions.id,
      instrumentId: corporateActions.instrumentId,
      symbol: instruments.tradingSymbol,
      actionType: corporateActions.actionType,
      exDate: corporateActions.exDate,
      recordDate: corporateActions.recordDate,
      ratioNumerator: corporateActions.ratioNumerator,
      ratioDenominator: corporateActions.ratioDenominator,
      dividendPerShare: corporateActions.dividendPerShare,
      priceAdjustmentFactor: corporateActions.priceAdjustmentFactor,
      volumeAdjustmentFactor: corporateActions.volumeAdjustmentFactor,
      source: corporateActions.source,
      status: corporateActions.status,
      notes: corporateActions.notes,
    })
    .from(corporateActions)
    .innerJoin(instruments, eq(instruments.id, corporateActions.instrumentId))
    .where(instrumentId ? eq(corporateActions.instrumentId, instrumentId) : undefined)
    .orderBy(desc(corporateActions.exDate))
    .limit(200);
}

export async function listUniverses() {
  return db
    .select({
      id: instrumentUniverses.id,
      code: instrumentUniverses.code,
      name: instrumentUniverses.name,
      description: instrumentUniverses.description,
      selectionMethod: instrumentUniverses.selectionMethod,
      lookbackSessions: instrumentUniverses.lookbackSessions,
      refreshCadence: instrumentUniverses.refreshCadence,
      isActive: instrumentUniverses.isActive,
      latestVersion: sql<number | null>`(
        select v.version from instrument_universe_versions v
        where v.universe_id = "instrument_universes"."id"
        order by v.version desc limit 1
      )`,
      latestMemberCount: sql<number | null>`(
        select v.member_count from instrument_universe_versions v
        where v.universe_id = "instrument_universes"."id"
        order by v.version desc limit 1
      )`,
      latestEffectiveFrom: sql<string | null>`(
        select v.effective_from::text from instrument_universe_versions v
        where v.universe_id = "instrument_universes"."id"
        order by v.version desc limit 1
      )`,
      versionCount: sql<number>`(
        select count(*)::int from instrument_universe_versions v
        where v.universe_id = "instrument_universes"."id"
      )`,
    })
    .from(instrumentUniverses)
    .orderBy(asc(instrumentUniverses.code));
}

export async function getUniverse(id: string) {
  const universe = (
    await db.select().from(instrumentUniverses).where(eq(instrumentUniverses.id, id)).limit(1)
  )[0];
  if (!universe) return null;

  const versions = await db
    .select()
    .from(instrumentUniverseVersions)
    .where(eq(instrumentUniverseVersions.universeId, id))
    .orderBy(desc(instrumentUniverseVersions.version));

  const members = versions.length
    ? await db
        .select({
          id: instrumentUniverseMembers.id,
          universeVersionId: instrumentUniverseMembers.universeVersionId,
          instrumentId: instrumentUniverseMembers.instrumentId,
          symbol: instruments.tradingSymbol,
          name: instruments.name,
          isin: instruments.isin,
          rank: instrumentUniverseMembers.rank,
          medianTradedValue: instrumentUniverseMembers.medianTradedValue,
          addedAt: instrumentUniverseMembers.addedAt,
          removedAt: instrumentUniverseMembers.removedAt,
        })
        .from(instrumentUniverseMembers)
        .innerJoin(instruments, eq(instruments.id, instrumentUniverseMembers.instrumentId))
        .where(
          inArray(
            instrumentUniverseMembers.universeVersionId,
            versions.map((v) => v.id),
          ),
        )
        .orderBy(asc(instrumentUniverseMembers.rank))
    : [];

  return {
    ...universe,
    versions: versions.map((version) => ({
      ...version,
      members: members.filter((member) => member.universeVersionId === version.id),
    })),
  };
}

export async function listTradingCalendar(filters: {
  from?: string;
  to?: string;
  exchangeCode?: string;
}) {
  const conditions = [];
  if (filters.from) conditions.push(gte(tradingCalendar.tradingDate, filters.from));
  if (filters.to) conditions.push(lte(tradingCalendar.tradingDate, filters.to));
  if (filters.exchangeCode) conditions.push(eq(exchanges.code, filters.exchangeCode));

  return db
    .select({
      id: tradingCalendar.id,
      exchangeCode: exchanges.code,
      tradingDate: tradingCalendar.tradingDate,
      isTradingDay: tradingCalendar.isTradingDay,
      sessionOpen: tradingCalendar.sessionOpen,
      sessionClose: tradingCalendar.sessionClose,
      preOpenStart: tradingCalendar.preOpenStart,
      closingAuctionStart: tradingCalendar.closingAuctionStart,
      closingAuctionEnd: tradingCalendar.closingAuctionEnd,
      settlementDate: tradingCalendar.settlementDate,
      description: tradingCalendar.description,
    })
    .from(tradingCalendar)
    .innerJoin(exchanges, eq(exchanges.id, tradingCalendar.exchangeId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(tradingCalendar.tradingDate))
    .limit(800);
}

export async function findProviderByCode(code: string) {
  const rows = await db.select().from(providers).where(eq(providers.code, code)).limit(1);
  return rows[0] ?? null;
}

export async function findProviderById(id: string) {
  const rows = await db.select().from(providers).where(eq(providers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findExchangeByCode(code: string) {
  const rows = await db.select().from(exchanges).where(eq(exchanges.code, code)).limit(1);
  return rows[0] ?? null;
}

export async function findProviderMapping(instrumentId: string, providerId: string) {
  const rows = await db
    .select()
    .from(instrumentProviderMappings)
    .where(
      and(
        eq(instrumentProviderMappings.instrumentId, instrumentId),
        eq(instrumentProviderMappings.providerId, providerId),
      ),
    )
    .orderBy(desc(instrumentProviderMappings.isPrimary), desc(instrumentProviderMappings.validFrom))
    .limit(1);
  return rows[0] ?? null;
}

export async function createRawProviderPayload(values: {
  providerId: string;
  endpoint: string;
  httpMethod: string;
  requestFingerprint: string;
  requestParams: Record<string, unknown> | null;
  httpStatus: number;
  contentEncoding: string | null;
  payload: unknown;
  payloadBytes: number;
  payloadSha256: string;
  retentionClass: string;
  expiresAt: Date | null;
}) {
  const [created] = await db
    .insert(rawProviderPayloads)
    .values({
      id: uuidv7(),
      providerId: values.providerId,
      endpoint: values.endpoint,
      httpMethod: values.httpMethod,
      requestFingerprint: values.requestFingerprint,
      requestParams: values.requestParams,
      httpStatus: values.httpStatus,
      contentEncoding: values.contentEncoding,
      payload: values.payload as Record<string, unknown> | unknown[],
      payloadBytes: values.payloadBytes,
      payloadSha256: values.payloadSha256,
      fetchedAt: new Date(),
      retentionClass: values.retentionClass,
      expiresAt: values.expiresAt,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const existing = await db
    .select()
    .from(rawProviderPayloads)
    .where(
      and(
        eq(rawProviderPayloads.providerId, values.providerId),
        eq(rawProviderPayloads.requestFingerprint, values.requestFingerprint),
        eq(rawProviderPayloads.payloadSha256, values.payloadSha256),
      ),
    )
    .limit(1);
  if (!existing[0]) throw new Error('Raw payload conflict could not be resolved');
  return existing[0];
}

export interface InstrumentMasterRow {
  externalKey: string;
  exchangeCode: string;
  tradingSymbol: string;
  name: string;
  shortName: string | null;
  isin: string | null;
  segment: string;
  instrumentType: string;
  lotSize: number;
  tickSize: string;
  freezeQuantity: string | null;
  exchangeToken: string | null;
  providerSymbol: string | null;
  providerSegment: string | null;
}

const R2_SEGMENTS = new Set(['NSE_EQ', 'NSE_INDEX']);
const R2_TYPES = new Set(['EQ', 'BE', 'INDEX']);

export function isR2Instrument(
  segment: string | null | undefined,
  instrumentType: string | null | undefined,
): boolean {
  return Boolean(
    segment && instrumentType && R2_SEGMENTS.has(segment) && R2_TYPES.has(instrumentType),
  );
}

/** Upstox expresses tick size in paise; canonical instruments store rupees. */
export function paiseToTickSize(value: number | null | undefined, fallback = '0.05'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  const rupees = value / 100;
  if (!(rupees > 0) || rupees > 100) return fallback;
  return rupees.toFixed(4);
}

export async function findInstrumentByIsin(isin: string) {
  const rows = await db
    .select({ id: instruments.id })
    .from(instruments)
    .where(eq(instruments.isin, isin.toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function findInstrumentBySymbol(
  exchangeId: string,
  segment: string,
  tradingSymbol: string,
) {
  const rows = await db
    .select({ id: instruments.id })
    .from(instruments)
    .where(
      and(
        eq(instruments.exchangeId, exchangeId),
        eq(instruments.segment, segment),
        eq(instruments.tradingSymbol, tradingSymbol),
        eq(instruments.isActive, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function resolveInstrument(
  tx: Transaction,
  providerId: string,
  exchangeId: string,
  row: InstrumentMasterRow,
): Promise<{ id: string; created: boolean }> {
  const mapping = await tx
    .select({ instrumentId: instrumentProviderMappings.instrumentId })
    .from(instrumentProviderMappings)
    .where(
      and(
        eq(instrumentProviderMappings.providerId, providerId),
        eq(instrumentProviderMappings.externalKey, row.externalKey),
      ),
    )
    .limit(1);
  if (mapping[0]) return { id: mapping[0].instrumentId, created: false };

  if (row.isin) {
    const byIsin = await tx
      .select({ id: instruments.id })
      .from(instruments)
      .where(eq(instruments.isin, row.isin.toUpperCase()))
      .limit(1);
    if (byIsin[0]) return { id: byIsin[0].id, created: false };
  }

  const bySymbol = await tx
    .select({ id: instruments.id })
    .from(instruments)
    .where(
      and(
        eq(instruments.exchangeId, exchangeId),
        eq(instruments.segment, row.segment),
        eq(instruments.tradingSymbol, row.tradingSymbol),
        eq(instruments.isActive, true),
      ),
    )
    .limit(1);
  if (bySymbol[0]) return { id: bySymbol[0].id, created: false };

  const [created] = await tx
    .insert(instruments)
    .values({
      id: uuidv7(),
      exchangeId,
      tradingSymbol: row.tradingSymbol,
      name: row.name,
      shortName: row.shortName,
      isin: row.isin,
      segment: row.segment,
      instrumentType: row.instrumentType,
      lotSize: row.lotSize,
      tickSize: row.tickSize,
      freezeQuantity: row.freezeQuantity,
      isActive: true,
      listedOn: null,
    })
    .returning({ id: instruments.id });
  return { id: created!.id, created: true };
}

/**
 * Reference sync is mapping-first. The NIFTY 50 index proves why: the provider
 * symbol is NIFTY while the canonical seed symbol is NIFTY 50, so symbol-only
 * matching would create a duplicate index.
 */
export async function upsertInstrumentMasterRows(
  providerId: string,
  rows: InstrumentMasterRow[],
  options: { indexTickFallback?: string; safetyCap?: number } = {},
): Promise<{
  instruments: number;
  mappings: number;
  skipped: number;
  excluded: number;
  limited: number;
}> {
  let instrumentsWritten = 0;
  let mappingsWritten = 0;
  let skipped = 0;
  let excluded = 0;

  const filtered = rows.filter((row) => {
    if (!isR2Instrument(row.segment, row.instrumentType)) {
      excluded += 1;
      return false;
    }
    return true;
  });
  const cap = options.safetyCap ?? 20_000;
  const limited = Math.max(0, filtered.length - cap);
  const scoped = filtered.slice(0, cap);

  await db.transaction(async (tx) => {
    for (const row of scoped) {
      const exchange = await tx
        .select({ id: exchanges.id })
        .from(exchanges)
        .where(eq(exchanges.code, row.exchangeCode))
        .limit(1);
      if (!exchange[0]) {
        skipped += 1;
        continue;
      }

      const resolved = await resolveInstrument(tx, providerId, exchange[0].id, row);
      const instrumentId = resolved.id;
      if (resolved.created) instrumentsWritten += 1;

      const tickSize =
        row.instrumentType === 'INDEX'
          ? row.tickSize || options.indexTickFallback || '0.1000'
          : row.tickSize;

      await tx
        .update(instruments)
        .set({
          name: row.name,
          shortName: row.shortName,
          isin: row.isin,
          segment: row.segment,
          instrumentType: row.instrumentType,
          lotSize: row.lotSize,
          tickSize,
          freezeQuantity: row.freezeQuantity,
          updatedAt: new Date(),
        })
        .where(eq(instruments.id, instrumentId));

      const existingMapping = await tx
        .select()
        .from(instrumentProviderMappings)
        .where(
          and(
            eq(instrumentProviderMappings.providerId, providerId),
            eq(instrumentProviderMappings.externalKey, row.externalKey),
          ),
        )
        .limit(1);

      if (existingMapping[0]) {
        if (existingMapping[0].instrumentId !== instrumentId) {
          await tx
            .update(instrumentProviderMappings)
            .set({ isPrimary: false, validTo: new Date(), updatedAt: new Date() })
            .where(eq(instrumentProviderMappings.id, existingMapping[0].id));
          await tx.insert(instrumentProviderMappings).values({
            id: uuidv7(),
            instrumentId,
            providerId,
            externalKey: row.externalKey,
            exchangeToken: row.exchangeToken,
            providerSymbol: row.providerSymbol,
            providerSegment: row.providerSegment,
            isPrimary: true,
            validFrom: new Date(),
            validTo: null,
          });
          mappingsWritten += 1;
        } else {
          await tx
            .update(instrumentProviderMappings)
            .set({
              exchangeToken: row.exchangeToken,
              providerSymbol: row.providerSymbol,
              providerSegment: row.providerSegment,
              isPrimary: true,
              validTo: null,
              updatedAt: new Date(),
            })
            .where(eq(instrumentProviderMappings.id, existingMapping[0].id));
        }
      } else {
        await tx.insert(instrumentProviderMappings).values({
          id: uuidv7(),
          instrumentId,
          providerId,
          externalKey: row.externalKey,
          exchangeToken: row.exchangeToken,
          providerSymbol: row.providerSymbol,
          providerSegment: row.providerSegment,
          isPrimary: true,
          validFrom: new Date(),
          validTo: null,
        });
        mappingsWritten += 1;
      }
    }
  });

  return {
    instruments: instrumentsWritten,
    mappings: mappingsWritten,
    skipped,
    excluded,
    limited,
  };
}

export async function syncTradingCalendarFixture(
  exchangeId: string,
  providerId: string,
  years: number[],
): Promise<number> {
  const rows: (typeof tradingCalendar.$inferInsert)[] = [];
  for (const year of years) {
    for (let month = 0; month < 12; month += 1) {
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // The date is already an IST business date; reading it as IST midnight shifts the
        // UTC weekday back by one, which would mark Mondays as weekends.
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const special = nseSpecialSessions[date];
        const holiday = nseHolidays[date];
        const isTradingDay = Boolean(special) || (weekday >= 1 && weekday <= 5 && !holiday);
        const open = special?.open ?? '09:15:00';
        const close = special?.close ?? '15:30:00';
        rows.push({
          id: uuidv7(),
          exchangeId,
          tradingDate: date,
          isTradingDay,
          sessionOpen: isTradingDay ? new Date(`${date}T${open}+05:30`) : null,
          sessionClose: isTradingDay ? new Date(`${date}T${close}+05:30`) : null,
          preOpenStart: isTradingDay && !special ? new Date(`${date}T09:00:00+05:30`) : null,
          closingAuctionStart: isTradingDay && !special ? new Date(`${date}T${close}+05:30`) : null,
          closingAuctionEnd: isTradingDay && !special ? new Date(`${date}T15:40:00+05:30`) : null,
          settlementDate: null,
          description: special?.description ?? holiday ?? (isTradingDay ? null : 'Weekend'),
          sourceProviderId: providerId,
        });
      }
    }
  }

  if (rows.length > 0) {
    await db
      .insert(tradingCalendar)
      .values(rows)
      .onConflictDoUpdate({
        target: [tradingCalendar.exchangeId, tradingCalendar.tradingDate],
        set: {
          isTradingDay: sql`excluded.is_trading_day`,
          sessionOpen: sql`excluded.session_open`,
          sessionClose: sql`excluded.session_close`,
          preOpenStart: sql`excluded.pre_open_start`,
          closingAuctionStart: sql`excluded.closing_auction_start`,
          closingAuctionEnd: sql`excluded.closing_auction_end`,
          description: sql`excluded.description`,
          sourceProviderId: sql`excluded.source_provider_id`,
          updatedAt: new Date(),
        },
      });
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// R2 reference, membership, catalog and corporate actions
// ---------------------------------------------------------------------------

export interface UniverseMemberImportRow {
  rank: number;
  instrumentId?: string;
  isin?: string | null;
  symbol?: string | null;
}

export async function getUniverseByCode(code: string) {
  const rows = await db
    .select()
    .from(instrumentUniverses)
    .where(eq(instrumentUniverses.code, code))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveUniverseVersion(code: string) {
  const rows = await db
    .select({
      universeId: instrumentUniverses.id,
      universeCode: instrumentUniverses.code,
      universeName: instrumentUniverses.name,
      versionId: instrumentUniverseVersions.id,
      version: instrumentUniverseVersions.version,
      effectiveFrom: instrumentUniverseVersions.effectiveFrom,
      effectiveTo: instrumentUniverseVersions.effectiveTo,
      memberCount: instrumentUniverseVersions.memberCount,
    })
    .from(instrumentUniverses)
    .innerJoin(
      instrumentUniverseVersions,
      and(
        eq(instrumentUniverseVersions.universeId, instrumentUniverses.id),
        isNull(instrumentUniverseVersions.effectiveTo),
      ),
    )
    .where(eq(instrumentUniverses.code, code))
    .orderBy(desc(instrumentUniverseVersions.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function listUniverseCatalog(filters: {
  universeCode?: string;
  fetchStatus?: string;
  dataStatus?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const universeCode = filters.universeCode ?? 'nifty-50';
  const conditions = [
    eq(instrumentUniverses.code, universeCode),
    isNull(instrumentUniverseVersions.effectiveTo),
  ];
  if (filters.fetchStatus)
    conditions.push(eq(instrumentDataStatus.fetchStatus, filters.fetchStatus));
  if (filters.dataStatus) conditions.push(eq(instrumentDataStatus.dataStatus, filters.dataStatus));
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(instruments.tradingSymbol, term),
      ilike(instruments.name, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  return db
    .select({
      rank: instrumentUniverseMembers.rank,
      instrumentId: instruments.id,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      isin: instruments.isin,
      segment: instruments.segment,
      instrumentType: instruments.instrumentType,
      tickSize: instruments.tickSize,
      isActive: instruments.isActive,
      listedOn: instruments.listedOn,
      delistedOn: instruments.delistedOn,
      universeCode: instrumentUniverses.code,
      universeVersionId: instrumentUniverseVersions.id,
      universeVersion: instrumentUniverseVersions.version,
      targetFrom: instrumentDataStatus.targetFrom,
      targetTo: instrumentDataStatus.targetTo,
      fetchStatus: instrumentDataStatus.fetchStatus,
      dataStatus: instrumentDataStatus.dataStatus,
      expectedDays: instrumentDataStatus.expectedDays,
      completeDays: instrumentDataStatus.completeDays,
      partialDays: instrumentDataStatus.partialDays,
      missingDays: instrumentDataStatus.missingDays,
      notApplicableDays: instrumentDataStatus.notApplicableDays,
      openCriticalIssues: instrumentDataStatus.openCriticalIssues,
      lastRunId: instrumentDataStatus.lastRunId,
      activeRunId: instrumentDataStatus.activeRunId,
      lastSuccessAt: instrumentDataStatus.lastSuccessAt,
      computedAt: instrumentDataStatus.computedAt,
      mappingCount: sql<number>`(
        select count(*)::int from instrument_provider_mappings m
        where m.instrument_id = ${instruments.id} and m.is_primary
      )`,
    })
    .from(instrumentUniverses)
    .innerJoin(
      instrumentUniverseVersions,
      eq(instrumentUniverseVersions.universeId, instrumentUniverses.id),
    )
    .innerJoin(
      instrumentUniverseMembers,
      eq(instrumentUniverseMembers.universeVersionId, instrumentUniverseVersions.id),
    )
    .innerJoin(instruments, eq(instruments.id, instrumentUniverseMembers.instrumentId))
    .leftJoin(instrumentDataStatus, eq(instrumentDataStatus.instrumentId, instruments.id))
    .where(and(...conditions))
    .orderBy(asc(instrumentUniverseMembers.rank), asc(instruments.id))
    .limit(Math.min(filters.limit ?? 200, 2000))
    .offset(filters.offset ?? 0);
}

export async function getInstrumentStatusDetail(instrumentId: string) {
  const rows = await db
    .select({
      instrumentId: instruments.id,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      isin: instruments.isin,
      segment: instruments.segment,
      instrumentType: instruments.instrumentType,
      tickSize: instruments.tickSize,
      isActive: instruments.isActive,
      listedOn: instruments.listedOn,
      delistedOn: instruments.delistedOn,
      targetFrom: instrumentDataStatus.targetFrom,
      targetTo: instrumentDataStatus.targetTo,
      fetchStatus: instrumentDataStatus.fetchStatus,
      dataStatus: instrumentDataStatus.dataStatus,
      expectedDays: instrumentDataStatus.expectedDays,
      completeDays: instrumentDataStatus.completeDays,
      partialDays: instrumentDataStatus.partialDays,
      missingDays: instrumentDataStatus.missingDays,
      notApplicableDays: instrumentDataStatus.notApplicableDays,
      openCriticalIssues: instrumentDataStatus.openCriticalIssues,
      lastRunId: instrumentDataStatus.lastRunId,
      activeRunId: instrumentDataStatus.activeRunId,
      lastSuccessAt: instrumentDataStatus.lastSuccessAt,
      computedAt: instrumentDataStatus.computedAt,
      mappingCount: sql<number>`(
        select count(*)::int from instrument_provider_mappings m
        where m.instrument_id = ${instruments.id} and m.is_primary
      )`,
    })
    .from(instruments)
    .leftJoin(instrumentDataStatus, eq(instrumentDataStatus.instrumentId, instruments.id))
    .where(eq(instruments.id, instrumentId))
    .limit(1);
  const status = rows[0];
  if (!status) return null;

  const months = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${marketDataCoverage.tradingDate}), 'YYYY-MM')`,
      complete: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'complete')::int`,
      partial: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'partial')::int`,
      missing: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'missing')::int`,
      notApplicable: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'not_applicable')::int`,
      reconciled: sql<number>`count(*) filter (where ${marketDataCoverage.validationStatus} = 'volume_reconciled')::int`,
      mismatch: sql<number>`count(*) filter (where ${marketDataCoverage.validationStatus} in ('volume_mismatch','ohlc_mismatch'))::int`,
    })
    .from(marketDataCoverage)
    .where(
      status.targetFrom && status.targetTo
        ? and(
            eq(marketDataCoverage.instrumentId, instrumentId),
            gte(marketDataCoverage.tradingDate, status.targetFrom),
            lte(marketDataCoverage.tradingDate, status.targetTo),
          )
        : eq(marketDataCoverage.instrumentId, instrumentId),
    )
    .groupBy(sql`date_trunc('month', ${marketDataCoverage.tradingDate})`)
    .orderBy(sql`date_trunc('month', ${marketDataCoverage.tradingDate})`);

  const runs = await db
    .select({
      id: marketDataIngestionRuns.id,
      runType: marketDataIngestionRuns.runType,
      status: marketDataIngestionRuns.status,
      requestedFrom: marketDataIngestionRuns.requestedFrom,
      requestedTo: marketDataIngestionRuns.requestedTo,
      rowsFetched: marketDataIngestionRuns.rowsFetched,
      rowsWritten: marketDataIngestionRuns.rowsWritten,
      rowsRejected: marketDataIngestionRuns.rowsRejected,
      startedAt: marketDataIngestionRuns.startedAt,
      finishedAt: marketDataIngestionRuns.finishedAt,
      errorMessage: marketDataIngestionRuns.errorMessage,
    })
    .from(marketDataIngestionRuns)
    .where(eq(marketDataIngestionRuns.instrumentId, instrumentId))
    .orderBy(desc(marketDataIngestionRuns.createdAt))
    .limit(25);

  const issues = await db
    .select({
      id: dataQualityIssues.id,
      ruleId: dataQualityIssues.ruleId,
      issueType: dataQualityIssues.issueType,
      severity: dataQualityIssues.severity,
      tradingDate: dataQualityIssues.tradingDate,
      status: dataQualityIssues.status,
      occurrenceCount: dataQualityIssues.occurrenceCount,
      lastSeenAt: dataQualityIssues.lastSeenAt,
    })
    .from(dataQualityIssues)
    .where(eq(dataQualityIssues.instrumentId, instrumentId))
    .orderBy(desc(dataQualityIssues.lastSeenAt))
    .limit(50);

  return { ...status, months, runs, issues };
}

export async function createInstrumentStatusRows(
  instrumentIds: string[],
  targetFrom: string,
  targetTo: string,
): Promise<number> {
  if (instrumentIds.length === 0) return 0;
  const rows = instrumentIds.map((instrumentId) => ({
    instrumentId,
    targetFrom,
    targetTo,
    fetchStatus: 'not_requested',
    dataStatus: 'pending',
  }));
  await db.insert(instrumentDataStatus).values(rows).onConflictDoNothing({
    target: instrumentDataStatus.instrumentId,
  });
  return rows.length;
}

export async function upsertInstrumentStatus(values: {
  instrumentId: string;
  targetFrom: string;
  targetTo: string;
  fetchStatus: string;
  dataStatus: string;
  expectedDays: number;
  completeDays: number;
  partialDays: number;
  missingDays: number;
  notApplicableDays: number;
  openCriticalIssues: number;
  lastRunId: string | null;
  activeRunId: string | null;
  lastSuccessAt: Date | null;
  computedAt: Date;
}) {
  const [row] = await db
    .insert(instrumentDataStatus)
    .values({ ...values, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: instrumentDataStatus.instrumentId,
      set: {
        targetFrom: values.targetFrom,
        targetTo: values.targetTo,
        fetchStatus: values.fetchStatus,
        dataStatus: values.dataStatus,
        expectedDays: values.expectedDays,
        completeDays: values.completeDays,
        partialDays: values.partialDays,
        missingDays: values.missingDays,
        notApplicableDays: values.notApplicableDays,
        openCriticalIssues: values.openCriticalIssues,
        lastRunId: values.lastRunId,
        activeRunId: values.activeRunId,
        lastSuccessAt: values.lastSuccessAt,
        computedAt: values.computedAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function getInstrumentStatusCounters(
  instrumentId: string,
  targetFrom: string,
  targetTo: string,
) {
  const coverage = await db
    .select({
      expectedDays: sql<number>`count(*) filter (where ${marketDataCoverage.status} <> 'not_applicable')::int`,
      completeDays: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'complete')::int`,
      partialDays: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'partial')::int`,
      missingDays: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'missing')::int`,
      notApplicableDays: sql<number>`count(*) filter (where ${marketDataCoverage.status} = 'not_applicable')::int`,
      reconciledDays: sql<number>`count(*) filter (where ${marketDataCoverage.validationStatus} = 'volume_reconciled')::int`,
      mismatchDays: sql<number>`count(*) filter (where ${marketDataCoverage.validationStatus} in ('volume_mismatch','ohlc_mismatch','daily_missing','minute_missing'))::int`,
    })
    .from(marketDataCoverage)
    .where(
      and(
        eq(marketDataCoverage.instrumentId, instrumentId),
        gte(marketDataCoverage.tradingDate, targetFrom),
        lte(marketDataCoverage.tradingDate, targetTo),
      ),
    );
  const counters = coverage[0] ?? {
    expectedDays: 0,
    completeDays: 0,
    partialDays: 0,
    missingDays: 0,
    notApplicableDays: 0,
    reconciledDays: 0,
    mismatchDays: 0,
  };
  const [issues] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dataQualityIssues)
    .where(
      and(
        eq(dataQualityIssues.instrumentId, instrumentId),
        eq(dataQualityIssues.severity, 'critical'),
        inArray(dataQualityIssues.status, ['open', 'acknowledged']),
      ),
    );
  return { ...counters, openCriticalIssues: issues?.count ?? 0 };
}

export async function importUniverseMembership(input: {
  universeCode: string;
  name: string;
  description?: string | null;
  effectiveFrom: string;
  members: UniverseMemberImportRow[];
  source: string;
  createdBy: string;
  sourceProviderId?: string | null;
  targetFrom: string;
  targetTo: string;
}) {
  if (input.members.length !== 51) {
    throw new Error(
      `nifty-50 membership must contain exactly 51 rows, received ${input.members.length}`,
    );
  }
  const ranks = new Set(input.members.map((member) => member.rank));
  if (ranks.size !== input.members.length) throw new Error('Universe member ranks must be unique');
  if (!input.members.some((member) => member.rank === 1))
    throw new Error('Rank 1 must be the index');

  return db.transaction(async (tx) => {
    let universe = (
      await tx
        .select()
        .from(instrumentUniverses)
        .where(eq(instrumentUniverses.code, input.universeCode))
        .limit(1)
    )[0];
    if (!universe) {
      [universe] = await tx
        .insert(instrumentUniverses)
        .values({
          id: uuidv7(),
          code: input.universeCode,
          name: input.name,
          description: input.description ?? null,
          selectionMethod: 'index_constituents',
          lookbackSessions: null,
          refreshCadence: 'manual',
          isActive: true,
          createdBy: input.createdBy,
        })
        .returning();
    }

    const active = (
      await tx
        .select()
        .from(instrumentUniverseVersions)
        .where(
          and(
            eq(instrumentUniverseVersions.universeId, universe!.id),
            isNull(instrumentUniverseVersions.effectiveTo),
          ),
        )
        .orderBy(desc(instrumentUniverseVersions.version))
        .limit(1)
    )[0];
    if (active && input.effectiveFrom <= active.effectiveFrom) {
      throw new Error(
        `A new universe version must start after ${active.effectiveFrom}; received ${input.effectiveFrom}`,
      );
    }

    const resolved: { instrumentId: string; rank: number }[] = [];
    for (const member of input.members) {
      let instrumentId = member.instrumentId ?? null;
      if (!instrumentId && member.isin) {
        const byIsin = await tx
          .select({ id: instruments.id })
          .from(instruments)
          .where(eq(instruments.isin, member.isin.toUpperCase()))
          .limit(1);
        instrumentId = byIsin[0]?.id ?? null;
      }
      if (!instrumentId && member.symbol) {
        const bySymbol = await tx
          .select({ id: instruments.id })
          .from(instruments)
          .where(eq(instruments.tradingSymbol, member.symbol))
          .limit(1);
        instrumentId = bySymbol[0]?.id ?? null;
      }
      if (!instrumentId) {
        throw new Error(`Universe member rank ${member.rank} could not be resolved`);
      }
      resolved.push({ instrumentId, rank: member.rank });
    }

    if (active) {
      const previousDay = new Date(`${input.effectiveFrom}T00:00:00Z`);
      previousDay.setUTCDate(previousDay.getUTCDate() - 1);
      await tx
        .update(instrumentUniverseVersions)
        .set({ effectiveTo: previousDay.toISOString().slice(0, 10) })
        .where(eq(instrumentUniverseVersions.id, active.id));
    }

    const version = active ? active.version + 1 : 1;
    const [created] = await tx
      .insert(instrumentUniverseVersions)
      .values({
        id: uuidv7(),
        universeId: universe!.id,
        version,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        memberCount: resolved.length,
        criteria: { source: input.source, importedAt: new Date().toISOString() },
        sourceProviderId: input.sourceProviderId ?? null,
        createdBy: input.createdBy,
      })
      .returning();

    await tx.insert(instrumentUniverseMembers).values(
      resolved.map((member) => ({
        id: uuidv7(),
        universeVersionId: created!.id,
        instrumentId: member.instrumentId,
        rank: member.rank,
        medianTradedValue: null,
        addedAt: input.effectiveFrom,
        removedAt: null,
      })),
    );

    await tx
      .insert(instrumentDataStatus)
      .values(
        resolved.map((member) => ({
          instrumentId: member.instrumentId,
          targetFrom: input.targetFrom,
          targetTo: input.targetTo,
          fetchStatus: 'not_requested',
          dataStatus: 'pending',
        })),
      )
      .onConflictDoNothing({ target: instrumentDataStatus.instrumentId });

    return {
      universeId: universe!.id,
      versionId: created!.id,
      version,
      members: resolved.length,
    };
  });
}

export interface CorporateActionImportRow {
  isin?: string | null;
  symbol?: string | null;
  exDate: string;
  actionType: string;
  ratioNumerator?: string | null;
  ratioDenominator?: string | null;
  dividendPerShare?: string | null;
  priceFactor?: string | null;
  volumeFactor?: string | null;
  source?: string;
  notes?: string | null;
  status?: 'announced' | 'confirmed';
}

const ACTION_TYPES = new Set([
  'split',
  'bonus',
  'dividend',
  'merger',
  'demerger',
  'rights',
  'symbol_change',
]);

export async function importCorporateActions(input: {
  rows: CorporateActionImportRow[];
  defaultSource: string;
  dryRun?: boolean;
}) {
  if (input.rows.length > 5000) throw new Error('At most 5,000 corporate-action rows are allowed');
  const results: {
    row: number;
    ok: boolean;
    error?: string;
    instrumentId?: string;
    action?: 'inserted' | 'updated' | 'unchanged';
  }[] = [];
  const valid: (CorporateActionImportRow & { instrumentId: string })[] = [];

  for (const [index, row] of input.rows.entries()) {
    const errors: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.exDate)) errors.push('exDate must be YYYY-MM-DD');
    if (!ACTION_TYPES.has(row.actionType)) errors.push(`unsupported actionType ${row.actionType}`);
    for (const [field, value] of Object.entries({
      ratioNumerator: row.ratioNumerator,
      ratioDenominator: row.ratioDenominator,
      dividendPerShare: row.dividendPerShare,
      priceFactor: row.priceFactor,
      volumeFactor: row.volumeFactor,
    })) {
      if (value === null || value === undefined || value === '') continue;
      const numeric = Number(value);
      const positive =
        field === 'priceFactor' ||
        field === 'volumeFactor' ||
        field === 'ratioNumerator' ||
        field === 'ratioDenominator';
      if (!Number.isFinite(numeric) || (positive ? numeric <= 0 : numeric < 0)) {
        errors.push(`${field} must be a ${positive ? 'positive' : 'non-negative'} number`);
      }
    }
    if (['split', 'bonus'].includes(row.actionType) && (!row.priceFactor || !row.volumeFactor)) {
      errors.push('split and bonus rows require priceFactor and volumeFactor');
    }
    let instrumentId: string | null = null;
    if (row.isin) {
      const found = await db
        .select({ id: instruments.id })
        .from(instruments)
        .where(eq(instruments.isin, row.isin.toUpperCase()))
        .limit(1);
      instrumentId = found[0]?.id ?? null;
    }
    if (!instrumentId && row.symbol) {
      const found = await db
        .select({ id: instruments.id })
        .from(instruments)
        .where(eq(instruments.tradingSymbol, row.symbol))
        .limit(1);
      instrumentId = found[0]?.id ?? null;
    }
    if (!instrumentId) errors.push('instrument could not be resolved');
    if (errors.length > 0) {
      results.push({ row: index + 1, ok: false, error: errors.join('; ') });
    } else {
      valid.push({ ...row, instrumentId: instrumentId! });
      results.push({ row: index + 1, ok: true, instrumentId: instrumentId! });
    }
  }

  if (input.dryRun) return { dryRun: true, results, imported: 0, updated: 0 };

  let imported = 0;
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const row of valid) {
      const values = {
        instrumentId: row.instrumentId,
        actionType: row.actionType,
        exDate: row.exDate,
        recordDate: null,
        ratioNumerator: row.ratioNumerator ?? null,
        ratioDenominator: row.ratioDenominator ?? null,
        dividendPerShare: row.dividendPerShare ?? null,
        priceAdjustmentFactor: row.priceFactor ?? '1',
        volumeAdjustmentFactor: row.volumeFactor ?? '1',
        source: row.source ?? input.defaultSource,
        status: row.status ?? 'announced',
        notes: row.notes ?? null,
      };
      const existing = await tx
        .select()
        .from(corporateActions)
        .where(
          and(
            eq(corporateActions.instrumentId, row.instrumentId),
            eq(corporateActions.actionType, row.actionType),
            eq(corporateActions.exDate, row.exDate),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await tx
          .update(corporateActions)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(corporateActions.id, existing[0].id));
        updated += 1;
      } else {
        await tx.insert(corporateActions).values({ id: uuidv7(), ...values });
        imported += 1;
      }
    }
  });

  return { dryRun: false, results, imported, updated };
}

export async function repairInstrumentTickSizes(tickSizes: Record<string, string>) {
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const [symbol, tickSize] of Object.entries(tickSizes)) {
      const result = await tx
        .update(instruments)
        .set({ tickSize, updatedAt: new Date() })
        .where(eq(instruments.tradingSymbol, symbol))
        .returning({ id: instruments.id });
      updated += result.length;
    }
  });
  return updated;
}

export async function getInstrumentsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      instrumentId: instruments.id,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      tickSize: instruments.tickSize,
      listedOn: instruments.listedOn,
      delistedOn: instruments.delistedOn,
      isActive: instruments.isActive,
      externalKey: sql<string | null>`(
        select m.external_key from instrument_provider_mappings m
        where m.instrument_id = ${instruments.id} and m.is_primary
        order by m.valid_from desc limit 1
      )`,
    })
    .from(instruments)
    .where(inArray(instruments.id, ids));
}

export async function hasConfirmedCorporateAction(
  instrumentId: string,
  exDate: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: corporateActions.id })
    .from(corporateActions)
    .where(
      and(
        eq(corporateActions.instrumentId, instrumentId),
        eq(corporateActions.exDate, exDate),
        eq(corporateActions.status, 'confirmed'),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}
