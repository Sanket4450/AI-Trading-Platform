import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import { nseHolidays } from '../fixtures/nse.js';
import {
  corporateActions,
  exchanges,
  instrumentProviderMappings,
  instrumentUniverseMembers,
  instrumentUniverseVersions,
  instrumentUniverses,
  instruments,
  providers,
  rawProviderPayloads,
  tradingCalendar,
} from '../schema/index.js';

export async function listInstruments(filters: {
  search?: string;
  segment?: string;
  activeOnly?: boolean;
  limit?: number;
}) {
  const conditions = [];
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(instruments.tradingSymbol, term), ilike(instruments.name, term)));
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
    .returning();
  return created;
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

export async function upsertInstrumentMasterRows(
  providerId: string,
  rows: InstrumentMasterRow[],
): Promise<{ instruments: number; mappings: number; skipped: number }> {
  let instrumentsWritten = 0;
  let mappingsWritten = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const exchange = await tx
        .select({ id: exchanges.id })
        .from(exchanges)
        .where(eq(exchanges.code, row.exchangeCode))
        .limit(1);
      if (!exchange[0]) {
        skipped += 1;
        continue;
      }

      const existingInstrument = await tx
        .select({ id: instruments.id })
        .from(instruments)
        .where(
          and(
            eq(instruments.exchangeId, exchange[0].id),
            eq(instruments.tradingSymbol, row.tradingSymbol),
            eq(instruments.isActive, true),
          ),
        )
        .limit(1);

      let instrumentId: string;
      if (existingInstrument[0]) {
        instrumentId = existingInstrument[0].id;
        await tx
          .update(instruments)
          .set({
            name: row.name,
            shortName: row.shortName,
            isin: row.isin,
            segment: row.segment,
            instrumentType: row.instrumentType,
            lotSize: row.lotSize,
            tickSize: row.tickSize,
            freezeQuantity: row.freezeQuantity,
            updatedAt: new Date(),
          })
          .where(eq(instruments.id, instrumentId));
      } else {
        const [created] = await tx
          .insert(instruments)
          .values({
            id: uuidv7(),
            exchangeId: exchange[0].id,
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
        instrumentId = created.id;
        instrumentsWritten += 1;
      }

      const existingMapping = await tx
        .select({ id: instrumentProviderMappings.id })
        .from(instrumentProviderMappings)
        .where(
          and(
            eq(instrumentProviderMappings.providerId, providerId),
            eq(instrumentProviderMappings.externalKey, row.externalKey),
          ),
        )
        .limit(1);

      if (existingMapping[0]) {
        await tx
          .update(instrumentProviderMappings)
          .set({
            instrumentId,
            exchangeToken: row.exchangeToken,
            providerSymbol: row.providerSymbol,
            providerSegment: row.providerSegment,
            isPrimary: true,
            validFrom: new Date(),
            validTo: null,
            updatedAt: new Date(),
          })
          .where(eq(instrumentProviderMappings.id, existingMapping[0].id));
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

  return { instruments: instrumentsWritten, mappings: mappingsWritten, skipped };
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
        const weekday = new Date(`${date}T00:00:00+05:30`).getUTCDay();
        const holiday = nseHolidays[date];
        const isTradingDay = weekday >= 1 && weekday <= 5 && !holiday;
        rows.push({
          id: uuidv7(),
          exchangeId,
          tradingDate: date,
          isTradingDay,
          sessionOpen: isTradingDay ? new Date(`${date}T09:15:00+05:30`) : null,
          sessionClose: isTradingDay ? new Date(`${date}T15:30:00+05:30`) : null,
          preOpenStart: isTradingDay ? new Date(`${date}T09:00:00+05:30`) : null,
          closingAuctionStart: isTradingDay ? new Date(`${date}T15:30:00+05:30`) : null,
          closingAuctionEnd: isTradingDay ? new Date(`${date}T15:40:00+05:30`) : null,
          settlementDate: null,
          description: holiday ?? (isTradingDay ? null : 'Weekend'),
          sourceProviderId: providerId,
        });
      }
    }
  }

  if (rows.length > 0) {
    await db
      .insert(tradingCalendar)
      .values(rows)
      .onConflictDoNothing({
        target: [tradingCalendar.exchangeId, tradingCalendar.tradingDate],
      });
  }
  return rows.length;
}
