import './load-env.js';
import { pathToFileURL } from 'node:url';
import { hash } from '@node-rs/argon2';
import { and, eq, sql } from 'drizzle-orm';
import { hashPayload } from '@ai-trading/domain';
import { uuidv7 } from 'uuidv7';
import { closeDatabase, db } from './client.js';
import * as schema from './schema/index.js';
import {
  NIFTY_50_INDEX,
  nifty50Constituents,
  nseHolidays,
  orbUniverseSymbols,
} from './fixtures/nse.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SeedOptions {
  email: string;
  password: string;
  operatorName?: string;
  accountCode?: string;
  accountName?: string;
  brokerUserRef?: string | null;
  forcePasswordReset?: boolean;
}

function istDate(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function istInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}+05:30`);
}

async function getProvider(tx: Transaction, code: string, name: string, kind: string) {
  const existing = await tx
    .select()
    .from(schema.providers)
    .where(eq(schema.providers.code, code))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await tx
    .insert(schema.providers)
    .values({
      id: uuidv7(),
      code,
      name,
      kind,
      capabilities: code === 'upstox' ? { historical: true, quotes: true, orders: true } : {},
      isActive: true,
    })
    .returning();
  return created;
}

async function getExchange(tx: Transaction, code: string, mic: string, name: string) {
  const existing = await tx
    .select()
    .from(schema.exchanges)
    .where(eq(schema.exchanges.code, code))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await tx
    .insert(schema.exchanges)
    .values({
      id: uuidv7(),
      code,
      mic,
      name,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      isActive: true,
    })
    .returning();
  return created;
}

async function getInstrument(
  tx: Transaction,
  exchangeId: string,
  values: {
    tradingSymbol: string;
    name: string;
    isin: string | null;
    segment: string;
    instrumentType: string;
  },
) {
  const existing = await tx
    .select()
    .from(schema.instruments)
    .where(
      and(
        eq(schema.instruments.exchangeId, exchangeId),
        eq(schema.instruments.tradingSymbol, values.tradingSymbol),
        eq(schema.instruments.isActive, true),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await tx
    .insert(schema.instruments)
    .values({
      id: uuidv7(),
      exchangeId,
      tradingSymbol: values.tradingSymbol,
      name: values.name,
      shortName: values.tradingSymbol,
      isin: values.isin,
      segment: values.segment,
      instrumentType: values.instrumentType,
      lotSize: 1,
      tickSize: '0.05',
      isActive: true,
      listedOn: '2000-01-01',
    })
    .returning();
  return created;
}

async function ensureMapping(
  tx: Transaction,
  providerId: string,
  instrumentId: string,
  externalKey: string,
  providerSymbol: string,
  providerSegment: string,
) {
  const existing = await tx
    .select()
    .from(schema.instrumentProviderMappings)
    .where(
      and(
        eq(schema.instrumentProviderMappings.providerId, providerId),
        eq(schema.instrumentProviderMappings.externalKey, externalKey),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await tx
    .insert(schema.instrumentProviderMappings)
    .values({
      id: uuidv7(),
      instrumentId,
      providerId,
      externalKey,
      providerSymbol,
      providerSegment,
      isPrimary: true,
      validFrom: new Date(),
      validTo: null,
    })
    .returning();
  return created;
}

async function getOrCreateConfig(
  tx: Transaction,
  values: {
    configType: string;
    scopeKey: string;
    version: number;
    payload: unknown;
    schemaVersion: string;
    effectiveFrom: Date;
    createdBy: string;
  },
) {
  const existing = await tx
    .select()
    .from(schema.configurationVersions)
    .where(
      and(
        eq(schema.configurationVersions.configType, values.configType),
        eq(schema.configurationVersions.scopeKey, values.scopeKey),
        eq(schema.configurationVersions.version, values.version),
      ),
    )
    .limit(1);

  const payloadHash = hashPayload(values.payload);
  if (existing[0]) {
    if (existing[0].payloadHash !== payloadHash) {
      throw new Error(
        `Configuration ${values.configType}/${values.scopeKey} v${values.version} already exists with a different payload`,
      );
    }
    return existing[0];
  }

  const [created] = await tx
    .insert(schema.configurationVersions)
    .values({
      id: uuidv7(),
      configType: values.configType,
      scopeKey: values.scopeKey,
      version: values.version,
      payload: values.payload as Record<string, unknown>,
      payloadHash,
      schemaVersion: values.schemaVersion,
      effectiveFrom: values.effectiveFrom,
      effectiveTo: null,
      createdBy: values.createdBy,
    })
    .returning();
  return created;
}

export async function seedDatabase(options: SeedOptions) {
  const operatorEmail = options.email.trim().toLowerCase();
  const operatorName = options.operatorName?.trim() || 'R1 Operator';
  const accountCode = options.accountCode?.trim() || 'upstox-primary';
  const accountName = options.accountName?.trim() || 'Upstox Primary';
  const brokerUserRef = options.brokerUserRef?.trim() || null;

  if (!operatorEmail) throw new Error('SEED_OPERATOR_EMAIL is required');
  if (!options.password) {
    throw new Error('SEED_OPERATOR_PASSWORD is required before seeding an operator');
  }

  const today = istDate();
  const now = new Date();
  const passwordHash = await hash(options.password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const summary = await db.transaction(async (tx) => {
    const upstox = await getProvider(tx, 'upstox', 'Upstox', 'both');
    await getProvider(tx, 'simulated', 'Simulated Broker', 'internal');
    await getProvider(tx, 'csv', 'CSV Import', 'market_data');

    const nse = await getExchange(tx, 'NSE', 'XNSE', 'National Stock Exchange of India');
    const bse = await getExchange(tx, 'BSE', 'XBOM', 'BSE Limited');

    let user = (
      await tx
        .select()
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = ${operatorEmail}`)
        .limit(1)
    )[0];

    if (!user) {
      [user] = await tx
        .insert(schema.users)
        .values({
          id: uuidv7(),
          email: operatorEmail,
          displayName: operatorName,
          passwordHash,
          role: 'admin',
          status: 'active',
          failedLoginCount: 0,
        })
        .returning();
    } else if (options.forcePasswordReset) {
      [user] = await tx
        .update(schema.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, user.id))
        .returning();
    }

    let account = (
      await tx.select().from(schema.accounts).where(eq(schema.accounts.code, accountCode)).limit(1)
    )[0];

    if (!account) {
      [account] = await tx
        .insert(schema.accounts)
        .values({
          id: uuidv7(),
          code: accountCode,
          displayName: accountName,
          brokerProviderId: upstox.id,
          brokerUserRef,
          baseCurrency: 'INR',
          mode: 'offline',
          timezone: 'Asia/Kolkata',
          isActive: true,
          openedAt: today,
        })
        .returning();
    } else {
      [account] = await tx
        .update(schema.accounts)
        .set({ mode: 'offline', isActive: true, updatedAt: new Date() })
        .where(eq(schema.accounts.id, account.id))
        .returning();
    }

    const access = await tx
      .select()
      .from(schema.userAccountAccess)
      .where(
        and(
          eq(schema.userAccountAccess.userId, user.id),
          eq(schema.userAccountAccess.accountId, account.id),
        ),
      )
      .limit(1);
    if (!access[0]) {
      await tx.insert(schema.userAccountAccess).values({
        id: uuidv7(),
        userId: user.id,
        accountId: account.id,
        role: 'owner',
        grantedBy: user.id,
        grantedAt: now,
        expiresAt: null,
      });
    }

    // Trading calendar for the current and next calendar year.
    const calendarRows: (typeof schema.tradingCalendar.$inferInsert)[] = [];
    for (const year of [2026, 2027]) {
      for (let month = 0; month < 12; month += 1) {
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        for (let day = 1; day <= daysInMonth; day += 1) {
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const weekday = new Date(`${date}T00:00:00+05:30`).getUTCDay();
          const holiday = nseHolidays[date];
          const isTradingDay = weekday >= 1 && weekday <= 5 && !holiday;
          calendarRows.push({
            id: uuidv7(),
            exchangeId: nse.id,
            tradingDate: date,
            isTradingDay,
            sessionOpen: isTradingDay ? istInstant(date, '09:15:00') : null,
            sessionClose: isTradingDay ? istInstant(date, '15:30:00') : null,
            preOpenStart: isTradingDay ? istInstant(date, '09:00:00') : null,
            closingAuctionStart: isTradingDay ? istInstant(date, '15:30:00') : null,
            closingAuctionEnd: isTradingDay ? istInstant(date, '15:40:00') : null,
            settlementDate: null,
            description: holiday ?? (isTradingDay ? null : 'Weekend'),
            sourceProviderId: upstox.id,
          });
        }
      }
    }

    await tx
      .insert(schema.tradingCalendar)
      .values(calendarRows)
      .onConflictDoNothing({
        target: [schema.tradingCalendar.exchangeId, schema.tradingCalendar.tradingDate],
      });

    const indexInstrument = await getInstrument(tx, nse.id, {
      tradingSymbol: NIFTY_50_INDEX.symbol,
      name: NIFTY_50_INDEX.name,
      isin: null,
      segment: 'NSE_INDEX',
      instrumentType: 'INDEX',
    });
    await ensureMapping(
      tx,
      upstox.id,
      indexInstrument.id,
      NIFTY_50_INDEX.externalKey,
      NIFTY_50_INDEX.symbol,
      'NSE_INDEX',
    );

    const instrumentBySymbol = new Map<string, typeof schema.instruments.$inferSelect>();
    for (const equity of nifty50Constituents) {
      const instrument = await getInstrument(tx, nse.id, {
        tradingSymbol: equity.symbol,
        name: equity.name,
        isin: equity.isin,
        segment: 'NSE_EQ',
        instrumentType: 'EQ',
      });
      instrumentBySymbol.set(equity.symbol, instrument);
      await ensureMapping(
        tx,
        upstox.id,
        instrument.id,
        equity.isin ? `NSE_EQ|${equity.isin}` : `PENDING:${equity.symbol}`,
        equity.symbol,
        'NSE_EQ',
      );
    }

    let universe = (
      await tx
        .select()
        .from(schema.instrumentUniverses)
        .where(eq(schema.instrumentUniverses.code, 'orb-liquid-20'))
        .limit(1)
    )[0];
    if (!universe) {
      [universe] = await tx
        .insert(schema.instrumentUniverses)
        .values({
          id: uuidv7(),
          code: 'orb-liquid-20',
          name: 'ORB Liquid 20',
          description:
            'Twenty liquid NSE cash equities selected by trailing 20-session median traded value.',
          selectionMethod: 'liquidity_median_value',
          lookbackSessions: 20,
          refreshCadence: 'weekly',
          isActive: true,
          createdBy: user.id,
        })
        .returning();
    }

    let universeVersion = (
      await tx
        .select()
        .from(schema.instrumentUniverseVersions)
        .where(
          and(
            eq(schema.instrumentUniverseVersions.universeId, universe.id),
            eq(schema.instrumentUniverseVersions.version, 1),
          ),
        )
        .limit(1)
    )[0];
    if (!universeVersion) {
      [universeVersion] = await tx
        .insert(schema.instrumentUniverseVersions)
        .values({
          id: uuidv7(),
          universeId: universe.id,
          version: 1,
          effectiveFrom: today,
          effectiveTo: null,
          memberCount: orbUniverseSymbols.length,
          criteria: {
            source: 'r1-fixture',
            selectionMethod: 'liquidity_median_value',
            lookbackSessions: 20,
            seedDate: today,
          },
          sourceProviderId: upstox.id,
          createdBy: user.id,
        })
        .returning();
    }

    for (const [index, symbol] of orbUniverseSymbols.entries()) {
      const instrument = instrumentBySymbol.get(symbol);
      if (!instrument) throw new Error(`Seed universe references unknown symbol ${symbol}`);
      const member = await tx
        .select()
        .from(schema.instrumentUniverseMembers)
        .where(
          and(
            eq(schema.instrumentUniverseMembers.universeVersionId, universeVersion.id),
            eq(schema.instrumentUniverseMembers.instrumentId, instrument.id),
          ),
        )
        .limit(1);
      if (!member[0]) {
        await tx.insert(schema.instrumentUniverseMembers).values({
          id: uuidv7(),
          universeVersionId: universeVersion.id,
          instrumentId: instrument.id,
          rank: index + 1,
          medianTradedValue: null,
          addedAt: today,
          removedAt: null,
        });
      }
    }

    let strategy = (
      await tx
        .select()
        .from(schema.strategies)
        .where(eq(schema.strategies.code, 'orb-15m'))
        .limit(1)
    )[0];
    if (!strategy) {
      [strategy] = await tx
        .insert(schema.strategies)
        .values({
          id: uuidv7(),
          code: 'orb-15m',
          name: '15-minute Opening Range Breakout',
          description:
            'Long-only opening-range breakout on liquid NSE cash equities with VWAP, market EMA and volume confirmation.',
          status: 'active',
          createdBy: user.id,
        })
        .returning();
    }

    let strategyVersion = (
      await tx
        .select()
        .from(schema.strategyVersions)
        .where(
          and(
            eq(schema.strategyVersions.strategyId, strategy.id),
            eq(schema.strategyVersions.version, 1),
          ),
        )
        .limit(1)
    )[0];
    if (!strategyVersion) {
      [strategyVersion] = await tx
        .insert(schema.strategyVersions)
        .values({
          id: uuidv7(),
          strategyId: strategy.id,
          version: 1,
          codeRef: 'r1-seed',
          parameterSchema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'openingRangeStart',
              'openingRangeEnd',
              'signalTimeframe',
              'entryWindowStart',
              'entryWindowEnd',
              'emaFastPeriod',
              'emaSlowPeriod',
              'volumeLookbackSessions',
              'volumeRatioMin',
              'targetRMultiple',
              'maxEntriesPerDay',
              'maxOpenPositions',
              'eodExitTime',
            ],
            properties: {
              openingRangeStart: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
              openingRangeEnd: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
              signalTimeframe: { type: 'string', enum: ['5m'] },
              entryWindowStart: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
              entryWindowEnd: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
              emaFastPeriod: { type: 'integer', minimum: 1 },
              emaSlowPeriod: { type: 'integer', minimum: 2 },
              vwapConfirmation: { type: 'boolean' },
              volumeLookbackSessions: { type: 'integer', minimum: 1 },
              volumeRatioMin: { type: 'number', minimum: 0 },
              stopMode: { type: 'string' },
              targetRMultiple: { type: 'number', minimum: 0.1 },
              maxEntriesPerStockPerSession: { type: 'integer', minimum: 1 },
              maxEntriesPerDay: { type: 'integer', minimum: 1 },
              maxOpenPositions: { type: 'integer', minimum: 1 },
              eodExitTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
              priceProtection: { type: 'boolean' },
            },
          },
          status: 'validated',
          changelog: 'R1 seed of the ORB specification in context/strategy1.md.',
          releasedAt: now,
          createdBy: user.id,
        })
        .returning();
    }

    const strategyConfig = await getOrCreateConfig(tx, {
      configType: 'strategy',
      scopeKey: 'orb-15m',
      version: 1,
      schemaVersion: '1.0.0',
      effectiveFrom: now,
      createdBy: user.id,
      payload: {
        strategy: 'orb-15m',
        openingRangeStart: '09:15',
        openingRangeEnd: '09:30',
        signalTimeframe: '5m',
        entryWindowStart: '09:30',
        entryWindowEnd: '14:15',
        emaFastPeriod: 20,
        emaSlowPeriod: 50,
        vwapConfirmation: true,
        volumeLookbackSessions: 20,
        volumeRatioMin: 1.5,
        stopMode: 'breakout_candle_low_minus_tick',
        targetRMultiple: 1.5,
        maxEntriesPerStockPerSession: 1,
        maxEntriesPerDay: 2,
        maxOpenPositions: 1,
        eodExitTime: '15:15',
        priceProtection: true,
      },
    });

    const riskConfig = await getOrCreateConfig(tx, {
      configType: 'risk',
      scopeKey: 'global',
      version: 1,
      schemaVersion: '1.0.0',
      effectiveFrom: now,
      createdBy: user.id,
      payload: {
        riskPerTradePct: 0.005,
        dailyLossLimitPct: 0.01,
        maxOpenPositions: 1,
        maxEntriesPerDay: 2,
        maxDrawdownPct: 0.08,
        killSwitchEnabled: true,
        staleDataSeconds: 90,
        requireProtectiveOrder: true,
      },
    });

    const systemConfig = await getOrCreateConfig(tx, {
      configType: 'system',
      scopeKey: 'global',
      version: 1,
      schemaVersion: '1.0.0',
      effectiveFrom: now,
      createdBy: user.id,
      payload: {
        tradingMode: 'offline',
        marketTimezone: 'Asia/Kolkata',
        dataStartDate: '2022-01-01',
        baseCurrency: 'INR',
      },
    });

    for (const [role, config] of [
      ['parameters', strategyConfig],
      ['risk', riskConfig],
      ['execution', systemConfig],
    ] as const) {
      const binding = await tx
        .select()
        .from(schema.strategyConfigBindings)
        .where(
          and(
            eq(schema.strategyConfigBindings.strategyVersionId, strategyVersion.id),
            eq(schema.strategyConfigBindings.configurationVersionId, config.id),
            eq(schema.strategyConfigBindings.role, role),
          ),
        )
        .limit(1);
      if (!binding[0]) {
        await tx.insert(schema.strategyConfigBindings).values({
          id: uuidv7(),
          strategyVersionId: strategyVersion.id,
          configurationVersionId: config.id,
          role,
          boundAt: now,
          boundBy: user.id,
        });
      }
    }

    for (const [index, symbol] of orbUniverseSymbols.entries()) {
      const instrument = instrumentBySymbol.get(symbol);
      if (!instrument) continue;

      const strategyMember = await tx
        .select()
        .from(schema.strategyUniverseMembers)
        .where(
          and(
            eq(schema.strategyUniverseMembers.strategyVersionId, strategyVersion.id),
            eq(schema.strategyUniverseMembers.instrumentId, instrument.id),
            eq(schema.strategyUniverseMembers.effectiveFrom, today),
          ),
        )
        .limit(1);
      if (!strategyMember[0]) {
        await tx.insert(schema.strategyUniverseMembers).values({
          id: uuidv7(),
          strategyVersionId: strategyVersion.id,
          instrumentId: instrument.id,
          universeVersionId: universeVersion.id,
          rank: index + 1,
          effectiveFrom: today,
          effectiveTo: null,
          isEnabled: true,
        });
      }

      const permission = await tx
        .select()
        .from(schema.accountInstrumentPermissions)
        .where(
          and(
            eq(schema.accountInstrumentPermissions.accountId, account.id),
            eq(schema.accountInstrumentPermissions.instrumentId, instrument.id),
            eq(schema.accountInstrumentPermissions.effectiveFrom, today),
          ),
        )
        .limit(1);
      if (!permission[0]) {
        await tx.insert(schema.accountInstrumentPermissions).values({
          id: uuidv7(),
          accountId: account.id,
          instrumentId: instrument.id,
          isTradable: true,
          productAllowlist: ['intraday'],
          maxQuantity: null,
          maxOpenQuantity: null,
          reason: 'R1 seed: ORB universe membership',
          effectiveFrom: today,
          effectiveTo: null,
          createdBy: user.id,
        });
      }
    }

    const settings: { key: string; value: unknown; description: string }[] = [
      {
        key: 'system.instance_name',
        value: 'ai-trading-r1',
        description: 'Human label for this installation.',
      },
      {
        key: 'system.trading_mode',
        value: 'offline',
        description: 'R1 is offline; no broker order is sent.',
      },
      { key: 'ui.theme', value: 'dark', description: 'Dashboard default theme.' },
      { key: 'ui.timezone', value: 'Asia/Kolkata', description: 'Display timezone.' },
      {
        key: 'data.retention.quotes_days',
        value: 90,
        description: 'Retention for quote snapshots.',
      },
      {
        key: 'data.retention.raw_payload_months',
        value: 12,
        description: 'Retention for standard raw payloads.',
      },
      { key: 'security.session_ttl_hours', value: 12, description: 'Opaque session lifetime.' },
      {
        key: 'seed.fixture_version',
        value: 'r1-2026-10',
        description: 'Reference fixture version used by the seed.',
      },
    ];

    for (const setting of settings) {
      await tx
        .insert(schema.systemSettings)
        .values({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          updatedBy: user.id,
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: {
            value: setting.value,
            description: setting.description,
            updatedBy: user.id,
            updatedAt: new Date(),
          },
        });
    }

    await tx.insert(schema.auditLog).values({
      id: uuidv7(),
      actorUserId: user.id,
      accountId: account.id,
      action: 'system.seeded',
      entityType: 'system',
      entityId: null,
      beforeState: null,
      afterState: {
        fixtureVersion: 'r1-2026-10',
        instruments: nifty50Constituents.length + 1,
        orbUniverse: orbUniverseSymbols.length,
        strategy: 'orb-15m',
        configurationVersions: [strategyConfig.id, riskConfig.id, systemConfig.id],
      },
      requestId: uuidv7(),
      ipAddress: '127.0.0.1',
      userAgent: 'seed-script',
    });

    return {
      user: user.email,
      account: account.code,
      exchanges: [nse.code, bse.code],
      instruments: instrumentBySymbol.size + 1,
      orbUniverse: orbUniverseSymbols.length,
      strategy: strategy.code,
      configurationVersions: 3,
      calendarRows: calendarRows.length,
    };
  });

  return summary;
}

async function main(): Promise<void> {
  const email = process.env.SEED_OPERATOR_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OPERATOR_PASSWORD;
  if (!email) throw new Error('SEED_OPERATOR_EMAIL is required');
  if (!password) {
    throw new Error('SEED_OPERATOR_PASSWORD is required before seeding an operator');
  }

  try {
    const summary = await seedDatabase({
      email,
      password,
      operatorName: process.env.SEED_OPERATOR_NAME,
      accountCode: process.env.SEED_ACCOUNT_CODE,
      accountName: process.env.SEED_ACCOUNT_NAME,
      brokerUserRef: process.env.SEED_BROKER_USER_REF,
      forcePasswordReset: process.env.SEED_FORCE_PASSWORD_RESET === 'true',
    });
    console.log('Seed complete.');
    console.table(summary);
  } finally {
    await closeDatabase();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
