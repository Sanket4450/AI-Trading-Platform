import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import {
  findProviderById,
  getAccountById,
  getAccountSummary,
  listAccountAccessByAccount,
  listAccountEquitySnapshots,
  listAccountPermissions,
  listAccounts,
  listBrokerCredentials,
  listTradingSessions,
  recordAudit,
  upsertBrokerCredential,
} from '@ai-trading/database';
import { offsetPage, backwardPage, forwardPage } from '../../common/pagination/page.js';
import {
  filterFingerprint,
  parseTimestampCursor,
  readDirectionalCursor,
} from '../../common/pagination/cursor.js';
import type { CursorQueryDto, OffsetQueryDto } from '../../common/pagination/pagination.dto.js';
import type { SearchOffsetQueryDto } from '../../common/pagination/search-offset-query.dto.js';
import { CredentialEncryptionService } from '../../common/security/credential-encryption.service.js';
import type { CreateCredentialDto } from './dto/create-credential.dto.js';

@Injectable()
export class AccountsService {
  constructor(private readonly encryption: CredentialEncryptionService) {}

  async list(query: SearchOffsetQueryDto) {
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listAccounts({ search: query.search, limit, offset });
    return offsetPage(result.items, result.total, limit, offset);
  }

  summary(query: SearchOffsetQueryDto) {
    return getAccountSummary(query.search);
  }

  async detail(accountId: string) {
    const account = await getAccountById(accountId);
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async permissions(accountId: string, query: OffsetQueryDto) {
    await this.detail(accountId);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listAccountPermissions(accountId, { limit, offset });
    return offsetPage(result.items, result.total, limit, offset);
  }

  credentials(accountId: string) {
    return listBrokerCredentials(accountId);
  }

  async access(accountId: string, query: OffsetQueryDto) {
    await this.detail(accountId);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listAccountAccessByAccount(accountId, { limit, offset });
    return offsetPage(result.items, result.total, limit, offset);
  }

  async equity(accountId: string, query: CursorQueryDto) {
    await this.detail(accountId);
    const fingerprint = filterFingerprint({ scope: 'account-equity', accountId });
    const { after, before } = readDirectionalCursor(query, fingerprint);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const afterKey = after ? parseTimestampCursor(after) : undefined;
    const beforeKey = before ? parseTimestampCursor(before) : undefined;
    const result = await listAccountEquitySnapshots(accountId, {
      limit,
      after: afterKey
        ? { capturedAt: afterKey.createdAt, id: afterKey.id }
        : undefined,
      before: beforeKey
        ? { capturedAt: beforeKey.createdAt, id: beforeKey.id }
        : undefined,
    });
    const items = result.items.map((row) => ({
      ...row,
      capturedAt: row.capturedAt.toISOString(),
      tradingDate: row.tradingDate,
    }));
    const keyOf = (item: (typeof items)[number]) => item.capturedAt;
    const idOf = (item: (typeof items)[number]) => item.id;

    if (before) {
      return backwardPage({
        items: items.reverse(),
        total: result.total,
        limit,
        hasExtra: result.hasExtra,
        fingerprint,
        keyOf,
        idOf,
      });
    }

    return forwardPage({
      items,
      total: result.total,
      limit,
      hasExtra: result.hasExtra,
      fingerprint,
      keyOf,
      idOf,
      hadAfter: Boolean(after),
    });
  }

  async sessions(accountId: string, query: CursorQueryDto) {
    await this.detail(accountId);
    const fingerprint = filterFingerprint({ scope: 'account-sessions', accountId });
    const { after, before } = readDirectionalCursor(query, fingerprint);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const result = await listTradingSessions({
      accountId,
      limit,
      after: after ? { tradingDate: after.key, id: after.id } : undefined,
      before: before ? { tradingDate: before.key, id: before.id } : undefined,
    });
    const items = result.items;
    const keyOf = (item: (typeof items)[number]) => item.tradingDate;
    const idOf = (item: (typeof items)[number]) => item.id;

    if (before) {
      return backwardPage({
        items: items.reverse(),
        total: result.total,
        limit,
        hasExtra: result.hasExtra,
        fingerprint,
        keyOf,
        idOf,
      });
    }

    return forwardPage({
      items,
      total: result.total,
      limit,
      hasExtra: result.hasExtra,
      fingerprint,
      keyOf,
      idOf,
      hadAfter: Boolean(after),
    });
  }

  async storeCredential(
    accountId: string,
    body: CreateCredentialDto,
    actorUserId: string,
    requestId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const account = await this.detail(accountId);

    await this.assertBrokerUserRef(account);

    const row = await upsertBrokerCredential({
      accountId: account.id,
      providerId: body.providerId,
      credentialType: body.credentialType,
      encryptedValue: this.encryption.encrypt(body.value),
      encryptionKeyVersion: this.encryption.keyVersion(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });

    await recordAudit({
      actorUserId,
      accountId: account.id,
      action: 'broker_credential.rotated',
      entityType: 'broker_credential',
      entityId: row.id,
      beforeState: null,
      afterState: {
        credentialType: row.credentialType,
        providerId: row.providerId,
        encryptionKeyVersion: row.encryptionKeyVersion,
        expiresAt: row.expiresAt,
      },
      requestId,
      ipAddress,
      userAgent,
    });

    return row;
  }

  /**
   * Broker-kind accounts identify the client by a provider-side reference (Upstox UCC).
   * Without it, credential storage would allow a broker connection that cannot be reconciled.
   */
  private async assertBrokerUserRef(
    account: Awaited<ReturnType<typeof getAccountById>>,
  ) {
    if (!account) throw new NotFoundException('Account not found');
    const provider = await findProviderById(account.brokerProviderId);
    if (!provider || !['broker', 'both'].includes(provider.kind)) {
      return;
    }

    if (account.brokerUserRef?.trim()) {
      return;
    }

    throw new BadRequestException(
      `Account "${account.code}" has no broker_user_ref; set the broker client code before storing credentials`,
    );
  }
}
