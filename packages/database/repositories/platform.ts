import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../client.js';
import {
  accountEquitySnapshots,
  accountInstrumentPermissions,
  accounts,
  auditLog,
  brokerCredentials,
  systemSettings,
  userAccountAccess,
  userSessions,
  users,
  instruments,
} from '../schema/index.js';

export async function findUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function markLoginSuccess(userId: string) {
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), failedLoginCount: 0, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function markLoginFailure(userId: string) {
  await db
    .update(users)
    .set({
      failedLoginCount: sql`${users.failedLoginCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function createSession(values: {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
}) {
  const [session] = await db.insert(userSessions).values(values).returning();
  return session;
}

export async function findSessionByTokenHash(tokenHash: string) {
  const rows = await db
    .select({
      session: userSessions,
      user: {
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
      },
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(eq(userSessions.tokenHash, tokenHash))
    .limit(1);
  return rows[0] ?? null;
}

export async function revokeSession(tokenHash: string) {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.tokenHash, tokenHash));
}

export async function touchSession(sessionId: string) {
  await db
    .update(userSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessions.id, sessionId));
}

export async function listAccounts() {
  return db
    .select({
      id: accounts.id,
      code: accounts.code,
      displayName: accounts.displayName,
      brokerProviderId: accounts.brokerProviderId,
      brokerUserRef: accounts.brokerUserRef,
      baseCurrency: accounts.baseCurrency,
      mode: accounts.mode,
      timezone: accounts.timezone,
      isActive: accounts.isActive,
      openedAt: accounts.openedAt,
      latestEquityAt: sql<string | null>`(
        select s.captured_at::text from account_equity_snapshots s
        where s.account_id = "accounts"."id"
        order by s.captured_at desc limit 1
      )`,
      latestNetEquity: sql<string | null>`(
        select s.net_equity::text from account_equity_snapshots s
        where s.account_id = "accounts"."id"
        order by s.captured_at desc limit 1
      )`,
      permissionCount: sql<number>`(
        select count(*)::int from account_instrument_permissions p
        where p.account_id = "accounts"."id"
          and p.is_tradable
          and (p.effective_to is null or p.effective_to >= current_date)
      )`,
      credentialExpiry: sql<string | null>`(
        select max(c.expires_at)::text from broker_credentials c
        where c.account_id = "accounts"."id"
      )`,
      openSessionCount: sql<number>`(
        select count(*)::int from trading_sessions t
        where t.account_id = "accounts"."id" and t.status = 'open'
      )`,
    })
    .from(accounts)
    .orderBy(asc(accounts.code));
}

export async function listAccountPermissions(accountId: string) {
  return db
    .select({
      id: accountInstrumentPermissions.id,
      instrumentId: accountInstrumentPermissions.instrumentId,
      symbol: instruments.tradingSymbol,
      name: instruments.name,
      isTradable: accountInstrumentPermissions.isTradable,
      productAllowlist: accountInstrumentPermissions.productAllowlist,
      effectiveFrom: accountInstrumentPermissions.effectiveFrom,
      effectiveTo: accountInstrumentPermissions.effectiveTo,
    })
    .from(accountInstrumentPermissions)
    .innerJoin(instruments, eq(instruments.id, accountInstrumentPermissions.instrumentId))
    .where(eq(accountInstrumentPermissions.accountId, accountId))
    .orderBy(asc(instruments.tradingSymbol));
}

export async function listAuditLog(filters: {
  actorUserId?: string;
  entityType?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const conditions = [];
  if (filters.actorUserId) conditions.push(eq(auditLog.actorUserId, filters.actorUserId));
  if (filters.entityType) conditions.push(eq(auditLog.entityType, filters.entityType));
  if (filters.action) conditions.push(ilike(auditLog.action, `%${filters.action}%`));
  if (filters.from) conditions.push(gte(auditLog.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditLog.createdAt, filters.to));

  return db
    .select({
      id: auditLog.id,
      actorUserId: auditLog.actorUserId,
      actorEmail: users.email,
      accountId: auditLog.accountId,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      beforeState: auditLog.beforeState,
      afterState: auditLog.afterState,
      requestId: auditLog.requestId,
      ipAddress: auditLog.ipAddress,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(filters.limit ?? 200);
}

export async function recordAudit(values: {
  actorUserId: string | null;
  accountId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState: unknown;
  afterState: unknown;
  requestId: string | null;
  ipAddress: string;
  userAgent: string;
}) {
  const [row] = await db
    .insert(auditLog)
    .values({
      actorUserId: values.actorUserId,
      accountId: values.accountId,
      action: values.action,
      entityType: values.entityType,
      entityId: values.entityId,
      beforeState: values.beforeState as Record<string, unknown> | null,
      afterState: values.afterState as Record<string, unknown> | null,
      requestId: values.requestId,
      ipAddress: values.ipAddress,
      userAgent: values.userAgent,
    })
    .returning();
  return row;
}

export async function listSystemSettings() {
  return db.select().from(systemSettings).orderBy(asc(systemSettings.key));
}

export async function upsertSystemSetting(values: {
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string;
}) {
  const [row] = await db
    .insert(systemSettings)
    .values({
      key: values.key,
      value: values.value,
      description: values.description,
      updatedBy: values.updatedBy,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: values.value,
        description: values.description,
        updatedBy: values.updatedBy,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function listBrokerCredentials(accountId: string) {
  return db
    .select({
      id: brokerCredentials.id,
      accountId: brokerCredentials.accountId,
      providerId: brokerCredentials.providerId,
      credentialType: brokerCredentials.credentialType,
      encryptionKeyVersion: brokerCredentials.encryptionKeyVersion,
      expiresAt: brokerCredentials.expiresAt,
      rotatedAt: brokerCredentials.rotatedAt,
      createdAt: brokerCredentials.createdAt,
    })
    .from(brokerCredentials)
    .where(eq(brokerCredentials.accountId, accountId))
    .orderBy(asc(brokerCredentials.credentialType));
}

export async function listAccountAccess(userId: string) {
  return db
    .select({
      id: userAccountAccess.id,
      accountId: userAccountAccess.accountId,
      accountCode: accounts.code,
      role: userAccountAccess.role,
      grantedAt: userAccountAccess.grantedAt,
      expiresAt: userAccountAccess.expiresAt,
    })
    .from(userAccountAccess)
    .innerJoin(accounts, eq(accounts.id, userAccountAccess.accountId))
    .where(
      and(
        eq(userAccountAccess.userId, userId),
        or(isNull(userAccountAccess.expiresAt), gte(userAccountAccess.expiresAt, new Date())),
      ),
    );
}

export async function listAccountEquitySnapshots(accountId: string, limit = 100) {
  return db
    .select()
    .from(accountEquitySnapshots)
    .where(eq(accountEquitySnapshots.accountId, accountId))
    .orderBy(desc(accountEquitySnapshots.capturedAt))
    .limit(limit);
}

export async function upsertBrokerCredential(values: {
  accountId: string;
  providerId: string;
  credentialType: string;
  encryptedValue: Buffer;
  encryptionKeyVersion: number;
  expiresAt: Date | null;
}) {
  const [row] = await db
    .insert(brokerCredentials)
    .values({
      accountId: values.accountId,
      providerId: values.providerId,
      credentialType: values.credentialType,
      encryptedValue: values.encryptedValue,
      encryptionKeyVersion: values.encryptionKeyVersion,
      expiresAt: values.expiresAt,
      rotatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [brokerCredentials.accountId, brokerCredentials.credentialType],
      set: {
        providerId: values.providerId,
        encryptedValue: values.encryptedValue,
        encryptionKeyVersion: values.encryptionKeyVersion,
        expiresAt: values.expiresAt,
        rotatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning({
      id: brokerCredentials.id,
      accountId: brokerCredentials.accountId,
      providerId: brokerCredentials.providerId,
      credentialType: brokerCredentials.credentialType,
      encryptionKeyVersion: brokerCredentials.encryptionKeyVersion,
      expiresAt: brokerCredentials.expiresAt,
      rotatedAt: brokerCredentials.rotatedAt,
    });
  return row;
}

export async function listAccountAccessByAccount(accountId: string) {
  return db
    .select({
      id: userAccountAccess.id,
      userId: userAccountAccess.userId,
      email: users.email,
      displayName: users.displayName,
      role: userAccountAccess.role,
      grantedAt: userAccountAccess.grantedAt,
      expiresAt: userAccountAccess.expiresAt,
    })
    .from(userAccountAccess)
    .innerJoin(users, eq(users.id, userAccountAccess.userId))
    .where(eq(userAccountAccess.accountId, accountId));
}
