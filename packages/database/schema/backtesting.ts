/**
 * R1 schema: backtesting
 *
 * Generated from context/r1-implementation-plan.html and then reviewed by hand.
 * Cross-table foreign keys, partial unique indexes, partitions and the
 * materialized view live in packages/database/migrations/*.sql because they
 * are easier to express and audit as explicit SQL.
 */

import { sql } from 'drizzle-orm';
import {
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
export const backtestRuns = pgTable(
  'backtest_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    configurationVersionId: uuid('configuration_version_id').notNull(),
    accountId: uuid('account_id'),
    name: varchar('name', { length: 160 }).notNull(),
    datasetFrom: date('dataset_from').notNull(),
    datasetTo: date('dataset_to').notNull(),
    initialCapital: numeric('initial_capital', { precision: 20, scale: 2 }).notNull(),
    costModelVersion: varchar('cost_model_version', { length: 30 }).notNull(),
    slippageModelVersion: varchar('slippage_model_version', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    parameters: jsonb('parameters')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_backtest_runs_strategy_version_id').on(table.strategyVersionId),
    check('chk_backtest_runs_dataset_from_1', sql`${table.datasetTo} > ${table.datasetFrom}`),
    check('chk_backtest_runs_initial_capital_2', sql`${table.initialCapital} > 0`),
    check(
      'chk_backtest_runs_status_3',
      sql`${table.status} in ('queued', 'running', 'completed', 'failed', 'cancelled')`,
    ),
    check(
      'chk_backtest_runs_started_at_4',
      sql`${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const backtestWindows = pgTable(
  'backtest_windows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    backtestRunId: uuid('backtest_run_id').notNull(),
    windowIndex: integer('window_index').notNull(),
    windowType: varchar('window_type', { length: 20 }).notNull(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    parameters: jsonb('parameters')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_backtest_windows_index').on(table.backtestRunId, table.windowIndex),
    check('chk_backtest_windows_window_index_1', sql`${table.windowIndex} >= 0`),
    check(
      'chk_backtest_windows_window_type_2',
      sql`${table.windowType} in ('development', 'validation', 'holdout', 'walk_forward', 'stress')`,
    ),
    check('chk_backtest_windows_from_date_3', sql`${table.toDate} > ${table.fromDate}`),
    check(
      'chk_backtest_windows_status_4',
      sql`${table.status} in ('queued', 'running', 'completed', 'failed', 'skipped')`,
    ),
  ],
);

export const backtestTrades = pgTable(
  'backtest_trades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    backtestRunId: uuid('backtest_run_id').notNull(),
    windowId: uuid('window_id'),
    instrumentId: uuid('instrument_id').notNull(),
    entryAt: timestamp('entry_at', { withTimezone: true }).notNull(),
    exitAt: timestamp('exit_at', { withTimezone: true }),
    direction: varchar('direction', { length: 10 }).notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    entryPrice: numeric('entry_price', { precision: 20, scale: 4 }).notNull(),
    exitPrice: numeric('exit_price', { precision: 20, scale: 4 }).notNull(),
    grossPnl: numeric('gross_pnl', { precision: 20, scale: 2 }).notNull(),
    costsTotal: numeric('costs_total', { precision: 20, scale: 2 }).default('0').notNull(),
    netPnl: numeric('net_pnl', { precision: 20, scale: 2 }).notNull(),
    initialStop: numeric('initial_stop', { precision: 20, scale: 4 }),
    target: numeric('target', { precision: 20, scale: 4 }),
    rMultiple: numeric('r_multiple', { precision: 20, scale: 6 }),
    exitReason: varchar('exit_reason', { length: 30 }).notNull(),
    signalSnapshot: jsonb('signal_snapshot')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_backtest_trades_backtest_run_id').on(table.backtestRunId),
    index('idx_backtest_trades_instrument_id').on(table.instrumentId),
    check(
      'chk_backtest_trades_entry_at_1',
      sql`${table.exitAt} is null or ${table.exitAt} > ${table.entryAt}`,
    ),
    check('chk_backtest_trades_direction_2', sql`${table.direction} in ('long', 'short')`),
    check('chk_backtest_trades_quantity_3', sql`${table.quantity} > 0`),
    check('chk_backtest_trades_entry_price_4', sql`${table.entryPrice} > 0`),
    check('chk_backtest_trades_exit_price_5', sql`${table.exitPrice} > 0`),
    check('chk_backtest_trades_initial_stop_6', sql`${table.initialStop} > 0`),
    check('chk_backtest_trades_target_7', sql`${table.target} > 0`),
    check(
      'chk_backtest_trades_exit_reason_8',
      sql`${table.exitReason} in ('target', 'stop', 'eod', 'risk', 'strategy_exit')`,
    ),
  ],
);

export const backtestEquityCurve = pgTable(
  'backtest_equity_curve',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    backtestRunId: uuid('backtest_run_id').notNull(),
    curveDate: date('curve_date').notNull(),
    equity: numeric('equity', { precision: 20, scale: 2 }).notNull(),
    cash: numeric('cash', { precision: 20, scale: 2 }).notNull(),
    openPnl: numeric('open_pnl', { precision: 20, scale: 2 }).default('0').notNull(),
    drawdownPct: numeric('drawdown_pct', { precision: 10, scale: 6 }).notNull(),
    exposure: numeric('exposure', { precision: 20, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_backtest_equity_point').on(table.backtestRunId, table.curveDate),
    check('chk_backtest_equity_curve_drawdown_pct_1', sql`${table.drawdownPct} >= 0`),
    check('chk_backtest_equity_curve_exposure_2', sql`${table.exposure} >= 0`),
  ],
);

export const backtestMetrics = pgTable(
  'backtest_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    backtestRunId: uuid('backtest_run_id').notNull(),
    metricKey: varchar('metric_key', { length: 60 }).notNull(),
    metricValue: numeric('metric_value', { precision: 28, scale: 10 }).notNull(),
    metricUnit: varchar('metric_unit', { length: 20 }),
    metricGroup: varchar('metric_group', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('uq_backtest_metrics_key').on(table.backtestRunId, table.metricKey)],
);

export const strategyPromotionReviews = pgTable(
  'strategy_promotion_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    backtestRunId: uuid('backtest_run_id'),
    reviewType: varchar('review_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    thresholds: jsonb('thresholds')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    results: jsonb('results')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_strategy_promotion_reviews_strategy_version_id').on(table.strategyVersionId),
    check(
      'chk_strategy_promotion_reviews_review_type_1',
      sql`${table.reviewType} in ('development', 'validation', 'holdout', 'walk_forward', 'stress', 'paper', 'live_pilot')`,
    ),
    check(
      'chk_strategy_promotion_reviews_status_2',
      sql`${table.status} in ('draft', 'passed', 'failed', 'waived')`,
    ),
  ],
);
