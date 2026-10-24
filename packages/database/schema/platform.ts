/**
 * R1 schema: platform
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
  inet,
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
import { bytea } from './_helpers.js';
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    failedLoginCount: smallint('failed_login_count').default(0).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('chk_users_role_1', sql`${table.role} in ('admin', 'operator', 'viewer')`),
    check('chk_users_status_2', sql`${table.status} in ('active', 'disabled', 'locked')`),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_user_sessions_token_hash').on(table.tokenHash),
    index('idx_user_sessions_user_id').on(table.userId),
    index('idx_user_sessions_expires_at').on(table.expiresAt),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 40 }).notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    brokerProviderId: uuid('broker_provider_id').notNull(),
    brokerUserRef: varchar('broker_user_ref', { length: 80 }),
    baseCurrency: char('base_currency', { length: 3 }).notNull(),
    mode: varchar('mode', { length: 20 }).notNull(),
    timezone: varchar('timezone', { length: 50 }).default('Asia/Kolkata').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    openedAt: date('opened_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_accounts_code').on(table.code),
    uniqueIndex('uq_accounts_provider_user').on(table.brokerProviderId, table.brokerUserRef),
    index('idx_accounts_is_active').on(table.isActive),
    check(
      'chk_accounts_mode_1',
      sql`${table.mode} in ('offline', 'research', 'backtesting', 'paper', 'live')`,
    ),
  ],
);

export const userAccountAccess = pgTable(
  'user_account_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    accountId: uuid('account_id').notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    grantedBy: uuid('granted_by'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_user_account_access_pair').on(table.userId, table.accountId),
    index('idx_user_account_access_account_id').on(table.accountId),
    check('chk_user_account_access_role_1', sql`${table.role} in ('owner', 'trader', 'viewer')`),
  ],
);

export const brokerCredentials = pgTable(
  'broker_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    providerId: uuid('provider_id').notNull(),
    credentialType: varchar('credential_type', { length: 30 }).notNull(),
    encryptedValue: bytea('encrypted_value').notNull(),
    encryptionKeyVersion: smallint('encryption_key_version').default(1).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_broker_credentials_account_type').on(table.accountId, table.credentialType),
    index('idx_broker_credentials_expires_at').on(table.expiresAt),
    check(
      'chk_broker_credentials_credential_type_1',
      sql`${table.credentialType} in ('api_key', 'api_secret', 'access_token', 'refresh_token', 'totp_secret')`,
    ),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id'),
    accountId: uuid('account_id'),
    action: varchar('action', { length: 80 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: uuid('entity_id'),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    requestId: uuid('request_id'),
    ipAddress: inet('ip_address').notNull(),
    userAgent: text('user_agent').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_log_actor_user_id').on(table.actorUserId),
    index('idx_audit_log_entity_type').on(table.entityType),
    index('idx_audit_log_entity_id').on(table.entityId),
  ],
);

export const domainEvents = pgTable(
  'domain_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aggregateType: varchar('aggregate_type', { length: 60 }).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishAttempts: smallint('publish_attempts').default(0).notNull(),
    lastError: text('last_error').default('').notNull(),
  },
  (table) => [
    index('idx_domain_events_aggregate_type').on(table.aggregateType),
    index('idx_domain_events_aggregate_id').on(table.aggregateId),
    index('idx_domain_events_published_at').on(table.publishedAt),
  ],
);

export const accountInstrumentPermissions = pgTable(
  'account_instrument_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull(),
    instrumentId: uuid('instrument_id').notNull(),
    isTradable: boolean('is_tradable').default(true).notNull(),
    productAllowlist: text('product_allowlist').array().notNull(),
    maxQuantity: numeric('max_quantity', { precision: 20, scale: 4 }),
    maxOpenQuantity: numeric('max_open_quantity', { precision: 20, scale: 4 }),
    reason: text('reason'),
    effectiveFrom: date('effective_from')
      .default(sql`current_date`)
      .notNull(),
    effectiveTo: date('effective_to'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_account_instrument_permissions_account_id').on(table.accountId),
    index('idx_account_instrument_permissions_instrument_id').on(table.instrumentId),
    check(
      'chk_account_instrument_permissions_product_allowlist_1',
      sql`${table.productAllowlist} <@ array['intraday','delivery','co','mtf']::text[]`,
    ),
    check('chk_account_instrument_permissions_max_quantity_2', sql`${table.maxQuantity} > 0`),
    check(
      'chk_account_instrument_permissions_max_open_quantity_3',
      sql`${table.maxOpenQuantity} > 0`,
    ),
    check(
      'chk_account_instrument_permissions_effective_to_4',
      sql`${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);
