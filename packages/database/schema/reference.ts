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
  smallint,
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
    capabilities: jsonb('capabilities')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
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
    mic: char('mic', { length: 4 }),
    name: varchar('name', { length: 120 }).notNull(),
    timezone: varchar('timezone', { length: 50 }).default('Asia/Kolkata').notNull(),
    currency: char('currency', { length: 3 }).default('INR').notNull(),
    isActive: boolean('is_active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_exchanges_code').on(table.code),
    uniqueIndex('uq_exchanges_mic').on(table.mic),
  ],
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
    lotSize: integer('lot_size').default(1).notNull(),
    tickSize: numeric('tick_size', { precision: 10, scale: 4 }).default('0.05').notNull(),
    freezeQuantity: numeric('freeze_quantity', { precision: 20, scale: 4 }),
    isActive: boolean('is_active').default(true).notNull(),
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
    check('chk_instruments_lot_size_1', sql`${table.lotSize} > 0`),
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
    rawPayloadId: uuid('raw_payload_id'),
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
    preOpenStart: timestamp('pre_open_start', { withTimezone: true }),
    closingAuctionStart: timestamp('closing_auction_start', { withTimezone: true }),
    closingAuctionEnd: timestamp('closing_auction_end', { withTimezone: true }),
    settlementDate: date('settlement_date'),
    description: varchar('description', { length: 200 }),
    sourceProviderId: uuid('source_provider_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_trading_calendar_exchange_date').on(table.exchangeId, table.tradingDate),
    index('idx_trading_calendar_trading_date').on(table.tradingDate),
    check('chk_trading_calendar_session_open_1', sql`${table.sessionClose} > ${table.sessionOpen}`),
  ],
);

export const corporateActions = pgTable(
  'corporate_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instrumentId: uuid('instrument_id').notNull(),
    actionType: varchar('action_type', { length: 30 }).notNull(),
    exDate: date('ex_date').notNull(),
    recordDate: date('record_date'),
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

export const instrumentUniverses = pgTable(
  'instrument_universes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 60 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    selectionMethod: varchar('selection_method', { length: 40 }).notNull(),
    lookbackSessions: integer('lookback_sessions'),
    refreshCadence: varchar('refresh_cadence', { length: 20 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_instrument_universes_code').on(table.code),
    check(
      'chk_instrument_universes_selection_method_1',
      sql`${table.selectionMethod} in ('manual', 'liquidity_median_value', 'index_constituents')`,
    ),
    check('chk_instrument_universes_lookback_sessions_2', sql`${table.lookbackSessions} > 0`),
    check(
      'chk_instrument_universes_refresh_cadence_3',
      sql`${table.refreshCadence} in ('daily', 'weekly', 'monthly', 'manual')`,
    ),
  ],
);

export const instrumentUniverseVersions = pgTable(
  'instrument_universe_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    universeId: uuid('universe_id').notNull(),
    version: integer('version').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    memberCount: integer('member_count').default(0).notNull(),
    criteria: jsonb('criteria')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    sourceProviderId: uuid('source_provider_id'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_instrument_universe_versions_number').on(table.universeId, table.version),
    check('chk_instrument_universe_versions_version_1', sql`${table.version} > 0`),
    check(
      'chk_instrument_universe_versions_effective_from_2',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
    check('chk_instrument_universe_versions_member_count_3', sql`${table.memberCount} >= 0`),
  ],
);

export const instrumentUniverseMembers = pgTable(
  'instrument_universe_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    universeVersionId: uuid('universe_version_id').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    rank: integer('rank').notNull(),
    medianTradedValue: numeric('median_traded_value', { precision: 20, scale: 2 }),
    addedAt: date('added_at').notNull(),
    removedAt: date('removed_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_instrument_universe_member').on(table.universeVersionId, table.instrumentId),
    uniqueIndex('uq_instrument_universe_rank').on(table.universeVersionId, table.rank),
    index('idx_instrument_universe_members_instrument_id').on(table.instrumentId),
    check('chk_instrument_universe_members_rank_1', sql`${table.rank} > 0`),
    check(
      'chk_instrument_universe_members_median_traded_value_2',
      sql`${table.medianTradedValue} >= 0`,
    ),
    check(
      'chk_instrument_universe_members_added_at_3',
      sql`${table.removedAt} is null or ${table.removedAt} >= ${table.addedAt}`,
    ),
  ],
);

export const rawProviderPayloads = pgTable(
  'raw_provider_payloads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id').notNull(),
    endpoint: varchar('endpoint', { length: 160 }).notNull(),
    httpMethod: varchar('http_method', { length: 10 }).notNull(),
    requestFingerprint: char('request_fingerprint', { length: 64 }).notNull(),
    requestParams: jsonb('request_params'),
    httpStatus: smallint('http_status').notNull(),
    contentEncoding: varchar('content_encoding', { length: 20 }),
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
    check('chk_raw_provider_payloads_http_status_1', sql`${table.httpStatus} between 100 and 599`),
    check(
      'chk_raw_provider_payloads_retention_class_2',
      sql`${table.retentionClass} in ('standard', 'extended', 'errors')`,
    ),
  ],
);

export const dataQualityIssues = pgTable(
  'data_quality_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id'),
    instrumentId: uuid('instrument_id'),
    issueType: varchar('issue_type', { length: 60 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    tradingDate: date('trading_date'),
    windowStart: timestamp('window_start', { withTimezone: true }),
    windowEnd: timestamp('window_end', { withTimezone: true }),
    details: jsonb('details')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    detectedBy: varchar('detected_by', { length: 30 }).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_data_quality_issues_instrument_id').on(table.instrumentId),
    index('idx_data_quality_issues_trading_date').on(table.tradingDate),
    check(
      'chk_data_quality_issues_issue_type_1',
      sql`${table.issueType} in ('missing_bar', 'duplicate_bar', 'invalid_ohlc', 'stale_quote', 'gap', 'outlier', 'corporate_action_mismatch', 'mapping_missing', 'coverage_shortfall')`,
    ),
    check(
      'chk_data_quality_issues_severity_2',
      sql`${table.severity} in ('info', 'warning', 'critical')`,
    ),
    check(
      'chk_data_quality_issues_window_start_3',
      sql`${table.windowEnd} is null or ${table.windowStart} is null or ${table.windowEnd} > ${table.windowStart}`,
    ),
    check(
      'chk_data_quality_issues_status_4',
      sql`${table.status} in ('open', 'acknowledged', 'resolved', 'ignored')`,
    ),
    check(
      'chk_data_quality_issues_detected_by_5',
      sql`${table.detectedBy} in ('ingestion', 'validation', 'reconciliation', 'manual')`,
    ),
  ],
);

export const marketDataIngestionRuns = pgTable(
  'market_data_ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: uuid('provider_id').notNull(),
    runType: varchar('run_type', { length: 30 }).notNull(),
    instrumentId: uuid('instrument_id'),
    timeframeUnit: varchar('timeframe_unit', { length: 10 }),
    timeframeInterval: integer('timeframe_interval'),
    requestedFrom: date('requested_from'),
    requestedTo: date('requested_to'),
    status: varchar('status', { length: 20 }).notNull(),
    rowsFetched: integer('rows_fetched').default(0).notNull(),
    rowsWritten: integer('rows_written').default(0).notNull(),
    rowsRejected: integer('rows_rejected').default(0).notNull(),
    errorMessage: text('error_message'),
    rawPayloadId: uuid('raw_payload_id'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_market_data_ingestion_runs_provider_id').on(table.providerId),
    index('idx_market_data_ingestion_runs_instrument_id').on(table.instrumentId),
    check(
      'chk_market_data_ingestion_runs_run_type_1',
      sql`${table.runType} in ('instrument_master', 'historical_backfill', 'intraday_sync', 'quote_snapshot', 'corporate_actions', 'calendar')`,
    ),
    check(
      'chk_market_data_ingestion_runs_timeframe_unit_2',
      sql`${table.timeframeUnit} in ('minutes','hours','days','weeks','months') and ${table.timeframeInterval} > 0`,
    ),
    check(
      'chk_market_data_ingestion_runs_requested_from_3',
      sql`${table.requestedTo} >= ${table.requestedFrom}`,
    ),
    check(
      'chk_market_data_ingestion_runs_status_4',
      sql`${table.status} in ('queued', 'running', 'succeeded', 'partially_failed', 'failed')`,
    ),
    check('chk_market_data_ingestion_runs_rows_fetched_5', sql`${table.rowsFetched} >= 0`),
    check('chk_market_data_ingestion_runs_rows_written_6', sql`${table.rowsWritten} >= 0`),
    check('chk_market_data_ingestion_runs_rows_rejected_7', sql`${table.rowsRejected} >= 0`),
    check(
      'chk_market_data_ingestion_runs_started_at_8',
      sql`${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
  ],
);
