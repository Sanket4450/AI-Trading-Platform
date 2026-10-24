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
  uniqueIndex,
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
    ingestionRunId: uuid('ingestion_run_id'),
    rawPayloadId: uuid('raw_payload_id'),
    isFinal: boolean('is_final').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
    netChange: numeric('net_change', { precision: 20, scale: 4 }),
    sourceProviderId: uuid('source_provider_id'),
    rawPayloadId: uuid('raw_payload_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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

export const marketDataCoverage = pgTable(
  'market_data_coverage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instrumentId: uuid('instrument_id').notNull(),
    tradingDate: date('trading_date').notNull(),
    expectedBars: integer('expected_bars').notNull(),
    storedBars: integer('stored_bars').notNull(),
    gapCount: integer('gap_count').default(0).notNull(),
    firstBarAt: timestamp('first_bar_at', { withTimezone: true }),
    lastBarAt: timestamp('last_bar_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_market_data_coverage_instrument_date').on(
      table.instrumentId,
      table.tradingDate,
    ),
    index('idx_market_data_coverage_trading_date').on(table.tradingDate),
    check('chk_market_data_coverage_expected_bars_1', sql`${table.expectedBars} >= 0`),
    check('chk_market_data_coverage_stored_bars_2', sql`${table.storedBars} >= 0`),
    check('chk_market_data_coverage_gap_count_3', sql`${table.gapCount} >= 0`),
    check(
      'chk_market_data_coverage_status_4',
      sql`${table.status} in ('complete', 'partial', 'missing')`,
    ),
  ],
);
