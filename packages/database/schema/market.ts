/**
 * R1 schema: market
 *
 * Generated from context/r1-implementation-plan.html and then reviewed by hand.
 * Cross-table foreign keys, partial unique indexes, partitions and the
 * materialized view live in packages/database/migrations/*.sql because they
 * are easier to express and audit as explicit SQL.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
export const marketCandles1m = pgTable(
  'market_candles_1m',
  {
    instrumentId: uuid('instrument_id').notNull(),
    candleStart: timestamp('candle_start', { withTimezone: true }).notNull(),
    tradingDate: date('trading_date').notNull(),
    open: numeric('open', { precision: 20, scale: 4 }).notNull(),
    high: numeric('high', { precision: 20, scale: 4 }).notNull(),
    low: numeric('low', { precision: 20, scale: 4 }).notNull(),
    close: numeric('close', { precision: 20, scale: 4 }).notNull(),
    volume: numeric('volume', { precision: 20, scale: 4 }).default('0').notNull(),
    sourceProviderId: uuid('source_provider_id').notNull(),
    rawPayloadId: uuid('raw_payload_id'),
    isFinal: boolean('is_final').default(true).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.instrumentId, table.candleStart] }),
    index('idx_market_candles_1m_trading_date').on(table.tradingDate),
    index('idx_market_candles_1m_source_provider_id').on(table.sourceProviderId),
    check('chk_market_candles_1m_open_1', sql`${table.open} > 0`),
    check(
      'chk_market_candles_1m_high_2',
      sql`${table.high} >= greatest(${table.open}, ${table.close}, ${table.low})`,
    ),
    check('chk_market_candles_1m_low_3', sql`${table.low} > 0`),
    check(
      'chk_market_candles_1m_low_4',
      sql`${table.low} <= least(${table.open}, ${table.close}, ${table.high})`,
    ),
    check('chk_market_candles_1m_close_5', sql`${table.close} > 0`),
    check('chk_market_candles_1m_volume_6', sql`${table.volume} >= 0`),
  ],
);

export const marketQuoteSnapshots = pgTable(
  'market_quote_snapshots',
  {
    instrumentId: uuid('instrument_id').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    tradingDate: date('trading_date').notNull(),
    lastPrice: numeric('last_price', { precision: 20, scale: 4 }).notNull(),
    averagePrice: numeric('average_price', { precision: 20, scale: 4 }),
    open: numeric('open', { precision: 20, scale: 4 }),
    high: numeric('high', { precision: 20, scale: 4 }),
    low: numeric('low', { precision: 20, scale: 4 }),
    close: numeric('close', { precision: 20, scale: 4 }),
    volume: numeric('volume', { precision: 20, scale: 4 }),
    bestBidPrice: numeric('best_bid_price', { precision: 20, scale: 4 }),
    bestBidQuantity: numeric('best_bid_quantity', { precision: 20, scale: 4 }),
    bestAskPrice: numeric('best_ask_price', { precision: 20, scale: 4 }),
    bestAskQuantity: numeric('best_ask_quantity', { precision: 20, scale: 4 }),
    totalBuyQuantity: numeric('total_buy_quantity', { precision: 20, scale: 4 }),
    totalSellQuantity: numeric('total_sell_quantity', { precision: 20, scale: 4 }),
    lowerCircuitLimit: numeric('lower_circuit_limit', { precision: 20, scale: 4 }),
    upperCircuitLimit: numeric('upper_circuit_limit', { precision: 20, scale: 4 }),
    sourceProviderId: uuid('source_provider_id'),
    rawPayloadId: uuid('raw_payload_id'),
  },
  (table) => [
    primaryKey({ columns: [table.instrumentId, table.capturedAt] }),
    index('idx_market_quote_snapshots_trading_date').on(table.tradingDate),
    check('chk_market_quote_snapshots_last_price_1', sql`${table.lastPrice} > 0`),
    check('chk_market_quote_snapshots_open_2', sql`${table.high} >= ${table.low}`),
    check('chk_market_quote_snapshots_volume_3', sql`${table.volume} >= 0`),
    check('chk_market_quote_snapshots_best_bid_price_4', sql`${table.bestBidPrice} >= 0`),
    check('chk_market_quote_snapshots_best_bid_quantity_5', sql`${table.bestBidQuantity} >= 0`),
    check('chk_market_quote_snapshots_best_ask_price_6', sql`${table.bestAskPrice} >= 0`),
    check('chk_market_quote_snapshots_best_ask_quantity_7', sql`${table.bestAskQuantity} >= 0`),
    check('chk_market_quote_snapshots_total_buy_quantity_8', sql`${table.totalBuyQuantity} >= 0`),
    check('chk_market_quote_snapshots_total_sell_quantity_9', sql`${table.totalSellQuantity} >= 0`),
  ],
);

/**
 * One row per instrument per expected trading day. Non-trading days and days
 * outside the listing window have no row: the calendar and the instrument
 * record already say nothing was expected.
 */
export const instrumentDayCoverage = pgTable(
  'instrument_day_coverage',
  {
    instrumentId: uuid('instrument_id').notNull(),
    tradingDate: date('trading_date').notNull(),
    expectedBars: integer('expected_bars').notNull(),
    storedBars: integer('stored_bars').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.instrumentId, table.tradingDate] }),
    index('idx_instrument_day_coverage_trading_date').on(table.tradingDate),
    check(
      'chk_instrument_day_coverage_counts',
      sql`${table.expectedBars} > 0 and ${table.storedBars} >= 0 and ${table.storedBars} <= ${table.expectedBars}`,
    ),
  ],
);

export const instrumentDataStatus = pgTable(
  'instrument_data_status',
  {
    instrumentId: uuid('instrument_id').primaryKey(),
    targetFrom: date('target_from').notNull(),
    targetTo: date('target_to').notNull(),
    fetchStatus: varchar('fetch_status', { length: 20 }).default('not_requested').notNull(),
    dataStatus: varchar('data_status', { length: 20 }).default('pending').notNull(),
    expectedDays: integer('expected_days').default(0).notNull(),
    completeDays: integer('complete_days').default(0).notNull(),
    partialDays: integer('partial_days').default(0).notNull(),
    missingDays: integer('missing_days').default(0).notNull(),
    openCriticalIssues: integer('open_critical_issues').default(0).notNull(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    computedAt: timestamp('computed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_instrument_status_fetch').on(table.fetchStatus, table.dataStatus),
    index('idx_instrument_status_last_success').on(table.lastSuccessAt),
    check(
      'chk_instrument_status_counters',
      sql`${table.expectedDays} >= 0 and ${table.completeDays} >= 0 and ${table.partialDays} >= 0 and ${table.missingDays} >= 0 and ${table.openCriticalIssues} >= 0 and ${table.targetTo} >= ${table.targetFrom}`,
    ),
    check(
      'chk_instrument_status_fetch',
      sql`${table.fetchStatus} in ('not_requested','queued','fetching','fetched','partial','failed','cancelled','stale')`,
    ),
    check(
      'chk_instrument_status_data',
      sql`${table.dataStatus} in ('complete','partial_mismatch','missing','pending','not_applicable','needs_review')`,
    ),
  ],
);
