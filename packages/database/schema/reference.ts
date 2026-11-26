/**
 * R1 schema: reference
 *
 * Generated from context/r1-implementation-plan.html and then reviewed by hand.
 * Cross-table foreign keys, partial unique indexes, partitions and the
 * materialized view live in packages/database/migrations/*.sql because they
 * are easier to express and audit as explicit SQL.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
export const providers = pgTable(
  'providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 30 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_providers_code').on(table.code),
    check(
      'chk_providers_kind_1',
      sql`${table.kind} in ('broker', 'market_data', 'both', 'internal')`,
    ),
  ],
);

export const exchanges = pgTable(
  'exchanges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 10 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('uq_exchanges_code').on(table.code)],
);

export const instruments = pgTable(
  'instruments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exchangeId: uuid('exchange_id').notNull(),
    tradingSymbol: varchar('trading_symbol', { length: 50 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    shortName: varchar('short_name', { length: 80 }),
    isin: char('isin', { length: 12 }),
    segment: varchar('segment', { length: 20 }).notNull(),
    instrumentType: varchar('instrument_type', { length: 20 }).notNull(),
    tickSize: numeric('tick_size', { precision: 10, scale: 4 }).default('0.05').notNull(),
    freezeQuantity: numeric('freeze_quantity', { precision: 20, scale: 4 }),
    isActive: boolean('is_active').default(true).notNull(),
    isSyncTarget: boolean('is_sync_target').default(false).notNull(),
    listedOn: date('listed_on'),
    delistedOn: date('delisted_on'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_instruments_isin').on(table.isin),
    index('idx_instruments_exchange_id').on(table.exchangeId),
    index('idx_instruments_trading_symbol').on(table.tradingSymbol),
    index('idx_instruments_is_active').on(table.isActive),
    index('idx_instruments_is_sync_target').on(table.isSyncTarget),
    check('chk_instruments_tick_size_2', sql`${table.tickSize} > 0`),
    check('chk_instruments_freeze_quantity_3', sql`${table.freezeQuantity} > 0`),
    check(
      'chk_instruments_delisted_on_4',
      sql`${table.delistedOn} is null or ${table.delistedOn} >= ${table.listedOn}`,
    ),
  ],
);

export const instrumentProviderMappings = pgTable(
  'instrument_provider_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instrumentId: uuid('instrument_id').notNull(),
    providerId: uuid('provider_id').notNull(),
    externalKey: varchar('external_key', { length: 120 }).notNull(),
    exchangeToken: varchar('exchange_token', { length: 40 }),
    providerSymbol: varchar('provider_symbol', { length: 80 }),
    providerSegment: varchar('provider_segment', { length: 30 }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_instrument_provider_external').on(table.providerId, table.externalKey),
    index('idx_instrument_provider_mappings_instrument_id').on(table.instrumentId),
    check(
      'chk_instrument_provider_mappings_valid_from_1',
      sql`${table.validTo} is null or ${table.validTo} > ${table.validFrom}`,
    ),
  ],
);

export const tradingCalendar = pgTable(
  'trading_calendar',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    exchangeId: uuid('exchange_id').notNull(),
    tradingDate: date('trading_date').notNull(),
    isTradingDay: boolean('is_trading_day').default(true).notNull(),
    sessionOpen: timestamp('session_open', { withTimezone: true }),
    sessionClose: timestamp('session_close', { withTimezone: true }),
    sessionBreaks: jsonb('session_breaks')
      .$type<{ start: string; end: string }[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    description: varchar('description', { length: 200 }),
    sourceProviderId: uuid('source_provider_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_trading_calendar_exchange_date').on(table.exchangeId, table.tradingDate),
    index('idx_trading_calendar_trading_date').on(table.tradingDate),
    check('chk_trading_calendar_session_open_1', sql`${table.sessionClose} > ${table.sessionOpen}`),
    check(
      'chk_trading_calendar_session_breaks_2',
      sql`jsonb_typeof(${table.sessionBreaks}) = 'array'`,
    ),
  ],
);

export const corporateActions = pgTable(
  'corporate_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instrumentId: uuid('instrument_id').notNull(),
    actionType: varchar('action_type', { length: 30 }).notNull(),
    exDate: date('ex_date').notNull(),
    ratioNumerator: numeric('ratio_numerator', { precision: 20, scale: 6 }),
    ratioDenominator: numeric('ratio_denominator', { precision: 20, scale: 6 }),
    dividendPerShare: numeric('dividend_per_share', { precision: 20, scale: 4 }),
    priceAdjustmentFactor: numeric('price_adjustment_factor', { precision: 20, scale: 10 })
      .default('1')
      .notNull(),
    volumeAdjustmentFactor: numeric('volume_adjustment_factor', { precision: 20, scale: 10 })
      .default('1')
      .notNull(),
    source: varchar('source', { length: 40 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_corporate_actions_instrument_type_date').on(
      table.instrumentId,
      table.actionType,
      table.exDate,
    ),
    index('idx_corporate_actions_ex_date').on(table.exDate),
    check(
      'chk_corporate_actions_action_type_1',
      sql`${table.actionType} in ('split', 'bonus', 'dividend', 'merger', 'demerger', 'rights', 'symbol_change')`,
    ),
    check(
      'chk_corporate_actions_ratio_numerator_2',
      sql`${table.ratioNumerator} > 0 and ${table.ratioDenominator} > 0`,
    ),
    check('chk_corporate_actions_dividend_per_share_3', sql`${table.dividendPerShare} >= 0`),
    check(
      'chk_corporate_actions_price_adjustment_factor_4',
      sql`${table.priceAdjustmentFactor} > 0`,
    ),
    check(
      'chk_corporate_actions_volume_adjustment_factor_5',
      sql`${table.volumeAdjustmentFactor} > 0`,
    ),
    check(
      'chk_corporate_actions_status_6',
      sql`${table.status} in ('announced', 'confirmed', 'applied')`,
    ),
  ],
);

export const rawProviderPayloads = pgTable(
  'raw_provider_payloads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id').notNull(),
    endpoint: varchar('endpoint', { length: 160 }).notNull(),
    requestFingerprint: char('request_fingerprint', { length: 64 }).notNull(),
    requestParams: jsonb('request_params'),
    payload: jsonb('payload').notNull(),
    payloadBytes: integer('payload_bytes').notNull(),
    payloadSha256: char('payload_sha256', { length: 64 }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
    retentionClass: varchar('retention_class', { length: 20 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_raw_provider_payloads_provider_id').on(table.providerId),
    index('idx_raw_provider_payloads_request_fingerprint').on(table.requestFingerprint),
    index('idx_raw_provider_payloads_expires_at').on(table.expiresAt),
    uniqueIndex('uq_raw_payload_request_hash').on(
      table.providerId,
      table.requestFingerprint,
      table.payloadSha256,
    ),
    check('chk_raw_provider_payloads_retention_class_2', sql`${table.retentionClass} in ('standard', 'extended', 'errors')`),
  ],
);

