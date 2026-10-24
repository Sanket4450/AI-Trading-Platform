/**
 * R1 schema: operations
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
export const dailyPerformance = pgTable(
  'daily_performance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    tradingDate: date('trading_date').notNull(),
    openingEquity: numeric('opening_equity', { precision: 20, scale: 2 }),
    closingEquity: numeric('closing_equity', { precision: 20, scale: 2 }),
    grossPnl: numeric('gross_pnl', { precision: 20, scale: 2 }).notNull(),
    costs: numeric('costs', { precision: 20, scale: 2 }).notNull(),
    netPnl: numeric('net_pnl', { precision: 20, scale: 2 }).notNull(),
    returnPct: numeric('return_pct', { precision: 10, scale: 6 }),
    maxDrawdownPct: numeric('max_drawdown_pct', { precision: 10, scale: 6 }),
    tradesCount: integer('trades_count').default(0).notNull(),
    winningTrades: integer('winning_trades').default(0).notNull(),
    losingTrades: integer('losing_trades').default(0).notNull(),
    winRate: numeric('win_rate', { precision: 10, scale: 6 }),
    riskLimitBreaches: integer('risk_limit_breaches').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_daily_performance_account_date').on(table.accountId, table.tradingDate),
    index('idx_daily_performance_trading_date').on(table.tradingDate),
    check('chk_daily_performance_max_drawdown_pct_1', sql`${table.maxDrawdownPct} >= 0`),
    check('chk_daily_performance_trades_count_2', sql`${table.tradesCount} >= 0`),
    check('chk_daily_performance_winning_trades_3', sql`${table.winningTrades} >= 0`),
    check('chk_daily_performance_losing_trades_4', sql`${table.losingTrades} >= 0`),
    check('chk_daily_performance_win_rate_5', sql`${table.winRate} >= 0 and ${table.winRate} <= 1`),
    check('chk_daily_performance_risk_limit_breaches_6', sql`${table.riskLimitBreaches} >= 0`),
  ],
);

export const strategyPerformanceDaily = pgTable(
  'strategy_performance_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    accountId: uuid('account_id').notNull(),
    tradingDate: date('trading_date').notNull(),
    grossPnl: numeric('gross_pnl', { precision: 20, scale: 2 }).notNull(),
    costs: numeric('costs', { precision: 20, scale: 2 }).notNull(),
    netPnl: numeric('net_pnl', { precision: 20, scale: 2 }).notNull(),
    tradesCount: integer('trades_count').default(0).notNull(),
    winningTrades: integer('winning_trades').default(0).notNull(),
    losingTrades: integer('losing_trades').default(0).notNull(),
    winRate: numeric('win_rate', { precision: 10, scale: 6 }),
    expectancy: numeric('expectancy', { precision: 20, scale: 6 }),
    profitFactor: numeric('profit_factor', { precision: 20, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_strategy_performance_day').on(
      table.strategyVersionId,
      table.accountId,
      table.tradingDate,
    ),
    index('idx_strategy_performance_daily_account_id').on(table.accountId),
    index('idx_strategy_performance_daily_trading_date').on(table.tradingDate),
    check('chk_strategy_performance_daily_trades_count_1', sql`${table.tradesCount} >= 0`),
    check('chk_strategy_performance_daily_winning_trades_2', sql`${table.winningTrades} >= 0`),
    check('chk_strategy_performance_daily_losing_trades_3', sql`${table.losingTrades} >= 0`),
    check(
      'chk_strategy_performance_daily_win_rate_4',
      sql`${table.winRate} >= 0 and ${table.winRate} <= 1`,
    ),
    check('chk_strategy_performance_daily_profit_factor_5', sql`${table.profitFactor} >= 0`),
  ],
);

export const jobRuns = pgTable(
  'job_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobName: varchar('job_name', { length: 80 }).notNull(),
    queueName: varchar('queue_name', { length: 40 }).notNull(),
    jobType: varchar('job_type', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    attempt: integer('attempt').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(0).notNull(),
    payload: jsonb('payload')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    result: jsonb('result'),
    errorMessage: text('error_message'),
    correlationId: uuid('correlation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_job_runs_job_name').on(table.jobName),
    index('idx_job_runs_scheduled_for').on(table.scheduledFor),
    index('idx_job_runs_correlation_id').on(table.correlationId),
    check(
      'chk_job_runs_job_type_1',
      sql`${table.jobType} in ('ingestion', 'backtest', 'analytics', 'reconciliation', 'square_off', 'report', 'maintenance', 'credential_refresh')`,
    ),
    check(
      'chk_job_runs_status_2',
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled')`,
    ),
    check(
      'chk_job_runs_started_at_3',
      sql`${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
    check('chk_job_runs_attempt_4', sql`${table.attempt} >= 0`),
  ],
);

export const systemHealthSnapshots = pgTable(
  'system_health_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
    component: varchar('component', { length: 60 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    latencyMs: integer('latency_ms'),
    details: jsonb('details')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'chk_system_health_snapshots_component_1',
      sql`${table.component} in ('api', 'web', 'worker', 'postgres', 'redis', 'upstox_api', 'market_data_feed')`,
    ),
    check(
      'chk_system_health_snapshots_status_2',
      sql`${table.status} in ('healthy', 'degraded', 'unhealthy', 'unknown')`,
    ),
    check('chk_system_health_snapshots_latency_ms_3', sql`${table.latencyMs} >= 0`),
  ],
);

export const notificationEvents = pgTable(
  'notification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: varchar('channel', { length: 30 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    subject: varchar('subject', { length: 200 }).notNull(),
    body: text('body').notNull(),
    relatedEntityType: varchar('related_entity_type', { length: 80 }),
    relatedEntityId: uuid('related_entity_id'),
    status: varchar('status', { length: 20 }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'chk_notification_events_channel_1',
      sql`${table.channel} in ('dashboard', 'email', 'webhook', 'log')`,
    ),
    check(
      'chk_notification_events_severity_2',
      sql`${table.severity} in ('info', 'warning', 'critical')`,
    ),
    check(
      'chk_notification_events_status_3',
      sql`${table.status} in ('pending', 'sent', 'failed', 'read')`,
    ),
  ],
);

export const reportRuns = pgTable(
  'report_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportType: varchar('report_type', { length: 30 }).notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    fileRef: varchar('file_ref', { length: 240 }),
    parameters: jsonb('parameters')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'chk_report_runs_report_type_1',
      sql`${table.reportType} in ('daily', 'monthly', 'strategy', 'risk', 'reconciliation')`,
    ),
    check('chk_report_runs_period_start_2', sql`${table.periodEnd} >= ${table.periodStart}`),
    check(
      'chk_report_runs_status_3',
      sql`${table.status} in ('queued', 'running', 'completed', 'failed')`,
    ),
  ],
);

export const systemSettings = pgTable(
  'system_settings',
  {
    key: varchar('key', { length: 80 }).notNull().primaryKey(),
    value: jsonb('value').notNull(),
    description: text('description'),
    updatedBy: uuid('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  () => [],
);
