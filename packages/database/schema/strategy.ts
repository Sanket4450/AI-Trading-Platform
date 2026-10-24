/**
 * R1 schema: strategy
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
export const strategies = pgTable(
  'strategies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 60 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_strategies_code').on(table.code),
    check(
      'chk_strategies_status_1',
      sql`${table.status} in ('draft', 'research', 'active', 'retired')`,
    ),
  ],
);

export const strategyVersions = pgTable(
  'strategy_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyId: uuid('strategy_id').notNull(),
    version: integer('version').notNull(),
    codeRef: varchar('code_ref', { length: 120 }).notNull(),
    parameterSchema: jsonb('parameter_schema').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    changelog: text('changelog'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_strategy_versions_number').on(table.strategyId, table.version),
    check('chk_strategy_versions_version_1', sql`${table.version} > 0`),
    check(
      'chk_strategy_versions_status_2',
      sql`${table.status} in ('draft', 'validated', 'active', 'retired')`,
    ),
  ],
);

export const configurationVersions = pgTable(
  'configuration_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    configType: varchar('config_type', { length: 30 }).notNull(),
    scopeKey: varchar('scope_key', { length: 80 }).notNull(),
    version: integer('version').notNull(),
    payload: jsonb('payload').notNull(),
    payloadHash: char('payload_hash', { length: 64 }).notNull(),
    schemaVersion: varchar('schema_version', { length: 20 }).notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    supersedesId: uuid('supersedes_id'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_configuration_versions_number').on(
      table.configType,
      table.scopeKey,
      table.version,
    ),
    index('idx_configuration_versions_scope_key').on(table.scopeKey),
    index('idx_configuration_versions_payload_hash').on(table.payloadHash),
    check(
      'chk_configuration_versions_config_type_1',
      sql`${table.configType} in ('strategy', 'risk', 'system')`,
    ),
    check('chk_configuration_versions_version_2', sql`${table.version} > 0`),
    check(
      'chk_configuration_versions_effective_from_3',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);

export const strategyConfigBindings = pgTable(
  'strategy_config_bindings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    configurationVersionId: uuid('configuration_version_id').notNull(),
    role: varchar('role', { length: 30 }).notNull(),
    boundAt: timestamp('bound_at', { withTimezone: true }).defaultNow().notNull(),
    boundBy: uuid('bound_by'),
  },
  (table) => [
    uniqueIndex('uq_strategy_config_binding').on(
      table.strategyVersionId,
      table.configurationVersionId,
      table.role,
    ),
    index('idx_strategy_config_bindings_configuration_version_id').on(table.configurationVersionId),
    check(
      'chk_strategy_config_bindings_role_1',
      sql`${table.role} in ('parameters', 'risk', 'execution')`,
    ),
  ],
);

export const strategyUniverseMembers = pgTable(
  'strategy_universe_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    universeVersionId: uuid('universe_version_id'),
    rank: integer('rank').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_strategy_universe_member').on(
      table.strategyVersionId,
      table.instrumentId,
      table.effectiveFrom,
    ),
    index('idx_strategy_universe_members_instrument_id').on(table.instrumentId),
    check('chk_strategy_universe_members_rank_1', sql`${table.rank} > 0`),
    check(
      'chk_strategy_universe_members_effective_from_2',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);

export const strategyActivations = pgTable(
  'strategy_activations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    strategyVersionId: uuid('strategy_version_id').notNull(),
    accountId: uuid('account_id').notNull(),
    configurationVersionId: uuid('configuration_version_id').notNull(),
    mode: varchar('mode', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull(),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    activatedBy: uuid('activated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_strategy_activations_strategy_version_id').on(table.strategyVersionId),
    index('idx_strategy_activations_account_id').on(table.accountId),
    check(
      'chk_strategy_activations_mode_1',
      sql`${table.mode} in ('research', 'backtesting', 'paper', 'live')`,
    ),
    check(
      'chk_strategy_activations_status_2',
      sql`${table.status} in ('scheduled', 'active', 'paused', 'stopped')`,
    ),
    check(
      'chk_strategy_activations_activated_at_3',
      sql`${table.deactivatedAt} is null or ${table.deactivatedAt} > ${table.activatedAt}`,
    ),
  ],
);

export const tradingSessions = pgTable(
  'trading_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    tradingDate: date('trading_date').notNull(),
    mode: varchar('mode', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    configurationVersionId: uuid('configuration_version_id'),
    openingEquity: numeric('opening_equity', { precision: 20, scale: 2 }),
    closingEquity: numeric('closing_equity', { precision: 20, scale: 2 }),
    killSwitchEngaged: boolean('kill_switch_engaged').default(false).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_trading_sessions_account_date_mode').on(
      table.accountId,
      table.tradingDate,
      table.mode,
    ),
    index('idx_trading_sessions_trading_date').on(table.tradingDate),
    check(
      'chk_trading_sessions_mode_1',
      sql`${table.mode} in ('offline', 'research', 'backtesting', 'paper', 'live')`,
    ),
    check(
      'chk_trading_sessions_status_2',
      sql`${table.status} in ('scheduled', 'open', 'closed', 'aborted')`,
    ),
    check(
      'chk_trading_sessions_started_at_3',
      sql`${table.endedAt} is null or ${table.endedAt} > ${table.startedAt}`,
    ),
  ],
);

export const riskEvents = pgTable(
  'risk_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tradingSessionId: uuid('trading_session_id').notNull(),
    accountId: uuid('account_id').notNull(),
    strategyVersionId: uuid('strategy_version_id'),
    instrumentId: uuid('instrument_id'),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    ruleCode: varchar('rule_code', { length: 60 }),
    observedValue: numeric('observed_value', { precision: 20, scale: 4 }),
    limitValue: numeric('limit_value', { precision: 20, scale: 4 }),
    details: jsonb('details')
      .default(sql`'{}'::jsonb`)
      .notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_risk_events_trading_session_id').on(table.tradingSessionId),
    check(
      'chk_risk_events_event_type_1',
      sql`${table.eventType} in ('limit_breach', 'trade_blocked', 'kill_switch', 'stale_data', 'protective_order_failure', 'reconciliation_mismatch', 'manual_override', 'data_quality_block')`,
    ),
    check('chk_risk_events_severity_2', sql`${table.severity} in ('info', 'warning', 'critical')`),
  ],
);
