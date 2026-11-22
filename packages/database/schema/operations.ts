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
  bigint,
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
    maxDrawdownPct: numeric('max_drawdown_pct', { precision: 10, scale: 6 }),
    tradesCount: integer('trades_count').default(0).notNull(),
    winningTrades: integer('winning_trades').default(0).notNull(),
    losingTrades: integer('losing_trades').default(0).notNull(),
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
    tradesCount: integer('trades_count').default(0).notNull(),
    winningTrades: integer('winning_trades').default(0).notNull(),
    losingTrades: integer('losing_trades').default(0).notNull(),
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
    check('chk_strategy_performance_daily_profit_factor_5', sql`${table.profitFactor} >= 0`),
  ],
);

export const jobRuns = pgTable(
  'job_runs',
  {
    id: uuid('id').primaryKey(),
    jobName: varchar('job_name', { length: 80 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    groupId: uuid('group_id'),
    instrumentId: uuid('instrument_id'),
    attempt: smallint('attempt').default(0).notNull(),
    maxAttempts: smallint('max_attempts').default(1).notNull(),
    payload: jsonb('payload')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    result: jsonb('result'),
    error: jsonb('error'),
    latestEventId: bigint('latest_event_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_job_runs_created').on(table.createdAt),
    index('idx_job_runs_name_status_finished').on(
      table.jobName,
      table.status,
      table.finishedAt,
    ),
    index('idx_job_runs_group').on(table.groupId),
    index('idx_job_runs_instrument').on(table.instrumentId),
    index('idx_job_runs_latest_event').on(table.latestEventId),
    check(
      'chk_job_runs_status',
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'partially_failed', 'cancelled')`,
    ),
    check(
      'chk_job_runs_time',
      sql`${table.finishedAt} is null or ${table.startedAt} is null or ${table.finishedAt} >= ${table.startedAt}`,
    ),
    check('chk_job_runs_attempt', sql`${table.attempt} >= 0`),
    check('chk_job_runs_max_attempts', sql`${table.maxAttempts} >= 1`),
  ],
);

export const jobRunEvents = pgTable(
  'job_run_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    jobRunId: uuid('job_run_id').notNull(),
    stage: varchar('stage', { length: 40 }).notNull(),
    type: varchar('type', { length: 16 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    data: jsonb('data')
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    index('idx_job_run_events_run').on(table.jobRunId, table.id),
    index('idx_job_run_events_stage').on(table.jobRunId, table.stage, table.id),
    index('idx_job_run_events_time').on(table.occurredAt),
    check(
      'chk_job_run_events_type',
      sql`${table.type} in ('entered', 'progress', 'completed', 'failed', 'skipped', 'warning')`,
    ),
  ],
);

export const externalApiCalls = pgTable(
  'external_api_calls',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    jobRunId: uuid('job_run_id'),
    instrumentId: uuid('instrument_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    latencyMs: integer('latency_ms').notNull(),
    service: varchar('service', { length: 32 }).notNull(),
    operation: varchar('operation', { length: 64 }).notNull(),
    requestScope: jsonb('request_scope')
      .default(sql`'{"path":{},"query":{},"body":{}}'::jsonb`)
      .notNull(),
    statusCode: smallint('status_code'),
    outcome: varchar('outcome', { length: 32 }).notNull(),
    errorBody: text('error_body'),
  },
  (table) => [
    index('idx_external_api_calls_started').on(table.startedAt),
    check('chk_external_api_calls_latency', sql`${table.latencyMs} >= 0`),
    check(
      'chk_external_api_calls_status',
      sql`${table.statusCode} is null or ${table.statusCode} between 100 and 599`,
    ),
    check(
      'chk_external_api_calls_outcome',
      sql`${table.outcome} in ('success','contract_error','auth_error','client_error','throttled','server_error','timeout','network_error','unknown')`,
    ),
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

/**
 * Current-state issue ledger. One row per active problem, deduped by the writer's
 * own identity fields. A successful re-run deletes its row instead of resolving it.
 */
export const systemIssues = pgTable(
  'system_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 64 }).notNull(),
    kind: varchar('kind', { length: 64 }).notNull(),
    severity: varchar('severity', { length: 32 }).notNull(),
    providerId: uuid('provider_id'),
    instrumentId: uuid('instrument_id'),
    dedupeKey: varchar('dedupe_key', { length: 64 }).notNull(),
    occurrenceCount: integer('occurrence_count').default(1).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_system_issues_dedupe').on(table.dedupeKey),
    index('idx_system_issues_triage').on(table.source, table.kind, table.lastSeenAt),
    index('idx_system_issues_instrument').on(table.instrumentId, table.lastSeenAt),
    index('idx_system_issues_provider').on(table.providerId, table.lastSeenAt),
    check('chk_system_issues_severity', sql`${table.severity} in ('info', 'warning', 'critical')`),
    check('chk_system_issues_occurrence', sql`${table.occurrenceCount} > 0`),
  ],
);
