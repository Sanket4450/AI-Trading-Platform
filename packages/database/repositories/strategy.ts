import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../client.js';
import {
  accounts,
  configurationVersions,
  riskEvents,
  strategies,
  strategyActivations,
  strategyConfigBindings,
  strategyVersions,
  tradingSessions,
} from '../schema/index.js';

function strategyConditions(search?: string) {
  return search
    ? [or(ilike(strategies.code, `%${search}%`), ilike(strategies.name, `%${search}%`))]
    : [];
}

export async function listStrategies(filters: {
  search?: string;
  limit: number;
  offset: number;
}) {
  const conditions = strategyConditions(filters.search);

  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: strategies.id,
        code: strategies.code,
        name: strategies.name,
        description: strategies.description,
        status: strategies.status,
        latestVersion: sql<number | null>`(
          select v.version from strategy_versions v
          where v.strategy_id = "strategies"."id"
          order by v.version desc limit 1
        )`,
        latestVersionStatus: sql<string | null>`(
          select v.status from strategy_versions v
          where v.strategy_id = "strategies"."id"
          order by v.version desc limit 1
        )`,
        versionCount: sql<number>`(
          select count(*)::int from strategy_versions v
          where v.strategy_id = "strategies"."id"
        )`,
        activeActivations: sql<number>`(
          select count(*)::int from strategy_activations a
          join strategy_versions v on v.id = a.strategy_version_id
          where v.strategy_id = "strategies"."id" and a.status = 'active'
        )`,
      })
      .from(strategies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(strategies.code))
      .limit(filters.limit)
      .offset(filters.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(strategies)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return { items, total: totalRows[0]?.total ?? 0 };
}

export async function getStrategySummary(search?: string) {
  const conditions = strategyConditions(search);
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      versions: sql<number>`coalesce(sum((
        select count(*)::int from strategy_versions v
        where v.strategy_id = "strategies"."id"
      )), 0)::int`,
      activeActivations: sql<number>`coalesce(sum((
        select count(*)::int from strategy_activations a
        join strategy_versions v on v.id = a.strategy_version_id
        where v.strategy_id = "strategies"."id" and a.status = 'active'
      )), 0)::int`,
    })
    .from(strategies)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return row ?? { total: 0, versions: 0, activeActivations: 0 };
}

export async function getStrategy(id: string) {
  const strategy = (await db.select().from(strategies).where(eq(strategies.id, id)).limit(1))[0];
  if (!strategy) return null;

  const versions = await db
    .select()
    .from(strategyVersions)
    .where(eq(strategyVersions.strategyId, id))
    .orderBy(desc(strategyVersions.version));

  const bindings = versions.length
    ? await db
        .select({
          id: strategyConfigBindings.id,
          strategyVersionId: strategyConfigBindings.strategyVersionId,
          configurationVersionId: strategyConfigBindings.configurationVersionId,
          role: strategyConfigBindings.role,
          boundAt: strategyConfigBindings.boundAt,
          boundBy: strategyConfigBindings.boundBy,
          configType: configurationVersions.configType,
          scopeKey: configurationVersions.scopeKey,
          configVersion: configurationVersions.version,
          payloadHash: configurationVersions.payloadHash,
          effectiveFrom: configurationVersions.effectiveFrom,
          effectiveTo: configurationVersions.effectiveTo,
        })
        .from(strategyConfigBindings)
        .innerJoin(
          configurationVersions,
          eq(configurationVersions.id, strategyConfigBindings.configurationVersionId),
        )
        .where(
          inArray(
            strategyConfigBindings.strategyVersionId,
            versions.map((v) => v.id),
          ),
        )
        .orderBy(asc(strategyConfigBindings.role))
    : [];

  const activations = versions.length
    ? await db
        .select({
          id: strategyActivations.id,
          strategyVersionId: strategyActivations.strategyVersionId,
          accountId: strategyActivations.accountId,
          accountCode: accounts.code,
          mode: strategyActivations.mode,
          status: strategyActivations.status,
          activatedAt: strategyActivations.activatedAt,
          deactivatedAt: strategyActivations.deactivatedAt,
        })
        .from(strategyActivations)
        .innerJoin(accounts, eq(accounts.id, strategyActivations.accountId))
        .where(
          inArray(
            strategyActivations.strategyVersionId,
            versions.map((v) => v.id),
          ),
        )
    : [];

  return {
    ...strategy,
    versions: versions.map((version) => ({
      ...version,
      bindings: bindings.filter((binding) => binding.strategyVersionId === version.id),
      activations: activations.filter((activation) => activation.strategyVersionId === version.id),
    })),
  };
}

export async function createStrategyVersion(values: {
  strategyId: string;
  codeRef: string;
  parameterSchema: Record<string, unknown>;
  changelog: string | null;
  createdBy: string;
}) {
  return db.transaction(async (tx) => {
    const strategy = (
      await tx.select().from(strategies).where(eq(strategies.id, values.strategyId)).limit(1)
    )[0];
    if (!strategy) throw new Error('Strategy not found');

    const next = (
      await tx
        .select({ version: sql<number>`coalesce(max(${strategyVersions.version}), 0) + 1` })
        .from(strategyVersions)
        .where(eq(strategyVersions.strategyId, values.strategyId))
    )[0];

    const [created] = await tx
      .insert(strategyVersions)
      .values({
        id: uuidv7(),
        strategyId: values.strategyId,
        version: Number(next.version),
        codeRef: values.codeRef,
        parameterSchema: values.parameterSchema,
        status: 'draft',
        changelog: values.changelog,
        releasedAt: null,
        createdBy: values.createdBy,
      })
      .returning();
    return created;
  });
}

function configurationConditions(filters: { configType?: string; scopeKey?: string }) {
  const conditions = [];
  if (filters.configType) conditions.push(eq(configurationVersions.configType, filters.configType));
  if (filters.scopeKey) conditions.push(ilike(configurationVersions.scopeKey, `%${filters.scopeKey}%`));
  return conditions;
}

export async function listConfigurationVersions(filters: {
  configType?: string;
  scopeKey?: string;
  limit: number;
  offset: number;
}) {
  const conditions = configurationConditions(filters);

  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: configurationVersions.id,
        configType: configurationVersions.configType,
        scopeKey: configurationVersions.scopeKey,
        version: configurationVersions.version,
        payload: configurationVersions.payload,
        payloadHash: configurationVersions.payloadHash,
        schemaVersion: configurationVersions.schemaVersion,
        effectiveFrom: configurationVersions.effectiveFrom,
        effectiveTo: configurationVersions.effectiveTo,
        supersedesId: configurationVersions.supersedesId,
        createdBy: configurationVersions.createdBy,
        createdAt: configurationVersions.createdAt,
      })
      .from(configurationVersions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(configurationVersions.createdAt), desc(configurationVersions.id))
      .limit(filters.limit)
      .offset(filters.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(configurationVersions)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return { items, total: totalRows[0]?.total ?? 0 };
}

export async function getConfigurationSummary(filters: {
  configType?: string;
  scopeKey?: string;
}) {
  const conditions = configurationConditions(filters);
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      configTypes: sql<number>`count(distinct ${configurationVersions.configType})::int`,
      scopeKeys: sql<number>`count(distinct ${configurationVersions.scopeKey})::int`,
    })
    .from(configurationVersions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return row ?? { total: 0, configTypes: 0, scopeKeys: 0 };
}

export async function getConfigurationVersion(id: string) {
  const version = (
    await db.select().from(configurationVersions).where(eq(configurationVersions.id, id)).limit(1)
  )[0];
  if (!version) return null;

  const bindings = await db
    .select({
      id: strategyConfigBindings.id,
      strategyVersionId: strategyConfigBindings.strategyVersionId,
      role: strategyConfigBindings.role,
      strategyCode: strategies.code,
      strategyVersion: strategyVersions.version,
      boundAt: strategyConfigBindings.boundAt,
    })
    .from(strategyConfigBindings)
    .innerJoin(strategyVersions, eq(strategyVersions.id, strategyConfigBindings.strategyVersionId))
    .innerJoin(strategies, eq(strategies.id, strategyVersions.strategyId))
    .where(eq(strategyConfigBindings.configurationVersionId, id));

  return { ...version, bindings };
}

export async function createConfigurationVersion(values: {
  configType: string;
  scopeKey: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  schemaVersion: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  supersedesId: string | null;
  createdBy: string;
}) {
  return db.transaction(async (tx) => {
    const next = (
      await tx
        .select({ version: sql<number>`coalesce(max(${configurationVersions.version}), 0) + 1` })
        .from(configurationVersions)
        .where(
          and(
            eq(configurationVersions.configType, values.configType),
            eq(configurationVersions.scopeKey, values.scopeKey),
          ),
        )
    )[0];

    const [created] = await tx
      .insert(configurationVersions)
      .values({
        id: uuidv7(),
        configType: values.configType,
        scopeKey: values.scopeKey,
        version: Number(next.version),
        payload: values.payload,
        payloadHash: values.payloadHash,
        schemaVersion: values.schemaVersion,
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo,
        supersedesId: values.supersedesId,
        createdBy: values.createdBy,
      })
      .returning();
    return created;
  });
}

export async function bindConfiguration(values: {
  strategyVersionId: string;
  configurationVersionId: string;
  role: string;
  boundBy: string;
}) {
  const [binding] = await db
    .insert(strategyConfigBindings)
    .values({
      id: uuidv7(),
      strategyVersionId: values.strategyVersionId,
      configurationVersionId: values.configurationVersionId,
      role: values.role,
      boundAt: new Date(),
      boundBy: values.boundBy,
    })
    .onConflictDoNothing({
      target: [
        strategyConfigBindings.strategyVersionId,
        strategyConfigBindings.configurationVersionId,
        strategyConfigBindings.role,
      ],
    })
    .returning();

  if (binding) return binding;

  const existing = await db
    .select()
    .from(strategyConfigBindings)
    .where(
      and(
        eq(strategyConfigBindings.strategyVersionId, values.strategyVersionId),
        eq(strategyConfigBindings.configurationVersionId, values.configurationVersionId),
        eq(strategyConfigBindings.role, values.role),
      ),
    )
    .limit(1);
  return existing[0] ?? null;
}

export async function resolveEffectiveConfiguration(
  strategyVersionId: string,
  role: string,
  at: Date = new Date(),
) {
  const rows = await db
    .select({
      configurationVersionId: configurationVersions.id,
      configType: configurationVersions.configType,
      scopeKey: configurationVersions.scopeKey,
      version: configurationVersions.version,
      payload: configurationVersions.payload,
      payloadHash: configurationVersions.payloadHash,
      effectiveFrom: configurationVersions.effectiveFrom,
      effectiveTo: configurationVersions.effectiveTo,
      role: strategyConfigBindings.role,
    })
    .from(strategyConfigBindings)
    .innerJoin(
      configurationVersions,
      eq(configurationVersions.id, strategyConfigBindings.configurationVersionId),
    )
    .where(
      and(
        eq(strategyConfigBindings.strategyVersionId, strategyVersionId),
        eq(strategyConfigBindings.role, role),
        lte(configurationVersions.effectiveFrom, at),
        or(
          isNull(configurationVersions.effectiveTo),
          sql`${configurationVersions.effectiveTo} > ${at}`,
        ),
      ),
    )
    .orderBy(desc(configurationVersions.effectiveFrom))
    .limit(1);
  return rows[0] ?? null;
}

export async function listTradingSessions(filters: {
  accountId?: string;
  limit: number;
  after?: { tradingDate: string; id: string };
  before?: { tradingDate: string; id: string };
}) {
  const backward = Boolean(filters.before);
  const cursor = filters.before ?? filters.after;
  const conditions = [];
  if (filters.accountId) conditions.push(eq(tradingSessions.accountId, filters.accountId));
  if (cursor) {
    conditions.push(
      backward
        ? sql`(${tradingSessions.tradingDate}, ${tradingSessions.id}) > (${cursor.tradingDate}::date, ${cursor.id}::uuid)`
        : sql`(${tradingSessions.tradingDate}, ${tradingSessions.id}) < (${cursor.tradingDate}::date, ${cursor.id}::uuid)`,
    );
  }
  const totalConditions = filters.accountId
    ? eq(tradingSessions.accountId, filters.accountId)
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: tradingSessions.id,
        accountId: tradingSessions.accountId,
        accountCode: accounts.code,
        tradingDate: tradingSessions.tradingDate,
        mode: tradingSessions.mode,
        status: tradingSessions.status,
        startedAt: tradingSessions.startedAt,
        endedAt: tradingSessions.endedAt,
        openingEquity: tradingSessions.openingEquity,
        closingEquity: tradingSessions.closingEquity,
        killSwitchEngaged: tradingSessions.killSwitchEngaged,
      })
      .from(tradingSessions)
      .innerJoin(accounts, eq(accounts.id, tradingSessions.accountId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        backward ? asc(tradingSessions.tradingDate) : desc(tradingSessions.tradingDate),
        backward ? asc(tradingSessions.id) : desc(tradingSessions.id),
      )
      .limit(filters.limit + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(tradingSessions)
      .where(totalConditions),
  ]);

  return {
    items: rows.slice(0, filters.limit),
    total: totalRows[0]?.total ?? 0,
    hasExtra: rows.length > filters.limit,
  };
}

export async function listRiskEvents(filters: { accountId?: string; limit?: number }) {
  return db
    .select({
      id: riskEvents.id,
      tradingSessionId: riskEvents.tradingSessionId,
      accountId: riskEvents.accountId,
      eventType: riskEvents.eventType,
      severity: riskEvents.severity,
      ruleCode: riskEvents.ruleCode,
      observedValue: riskEvents.observedValue,
      limitValue: riskEvents.limitValue,
      details: riskEvents.details,
      occurredAt: riskEvents.occurredAt,
      resolvedAt: riskEvents.resolvedAt,
    })
    .from(riskEvents)
    .where(filters.accountId ? eq(riskEvents.accountId, filters.accountId) : undefined)
    .orderBy(desc(riskEvents.occurredAt))
    .limit(filters.limit ?? 50);
}

export async function findLatestStrategyVersionByCode(code: string) {
  const rows = await db
    .select({
      strategyId: strategies.id,
      strategyCode: strategies.code,
      strategyName: strategies.name,
      strategyVersionId: strategyVersions.id,
      version: strategyVersions.version,
      status: strategyVersions.status,
      parameterSchema: strategyVersions.parameterSchema,
    })
    .from(strategies)
    .innerJoin(strategyVersions, eq(strategyVersions.strategyId, strategies.id))
    .where(eq(strategies.code, code))
    .orderBy(desc(strategyVersions.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function getStrategyVersion(id: string) {
  const rows = await db
    .select({
      id: strategyVersions.id,
      strategyId: strategyVersions.strategyId,
      strategyCode: strategies.code,
      version: strategyVersions.version,
      codeRef: strategyVersions.codeRef,
      parameterSchema: strategyVersions.parameterSchema,
      status: strategyVersions.status,
      changelog: strategyVersions.changelog,
      releasedAt: strategyVersions.releasedAt,
      createdAt: strategyVersions.createdAt,
    })
    .from(strategyVersions)
    .innerJoin(strategies, eq(strategies.id, strategyVersions.strategyId))
    .where(eq(strategyVersions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findConfigurationByHash(values: {
  configType: string;
  scopeKey: string;
  payloadHash: string;
}) {
  const rows = await db
    .select()
    .from(configurationVersions)
    .where(
      and(
        eq(configurationVersions.configType, values.configType),
        eq(configurationVersions.scopeKey, values.scopeKey),
        eq(configurationVersions.payloadHash, values.payloadHash),
      ),
    )
    .orderBy(desc(configurationVersions.version))
    .limit(1);
  return rows[0] ?? null;
}
