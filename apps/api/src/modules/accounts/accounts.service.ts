import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  findProviderById,
  listAccountAccessByAccount,
  listAccountEquitySnapshots,
  listAccountPermissions,
  listAccounts,
  listBrokerCredentials,
  listTradingSessions,
  recordAudit,
  upsertBrokerCredential,
} from '@ai-trading/database';
import { CredentialEncryptionService } from '../../common/security/credential-encryption.service.js';
import type { CreateCredentialDto } from './dto/create-credential.dto.js';

@Injectable()
export class AccountsService {
  constructor(private readonly encryption: CredentialEncryptionService) {}

  list() {
    return listAccounts();
  }

  async permissions(accountId: string) {
    const accounts = await listAccounts();
    if (!accounts.some((account) => account.id === accountId)) {
      throw new NotFoundException('Account not found');
    }
    return listAccountPermissions(accountId);
  }

  credentials(accountId: string) {
    return listBrokerCredentials(accountId);
  }

  access(accountId: string) {
    return listAccountAccessByAccount(accountId);
  }

  equity(accountId: string) {
    return listAccountEquitySnapshots(accountId);
  }

  sessions(accountId: string) {
    return listTradingSessions({ accountId });
  }

  async storeCredential(
    accountId: string,
    body: CreateCredentialDto,
    actorUserId: string,
    requestId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const accounts = await listAccounts();
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.assertBrokerUserRef(account);

    const row = await upsertBrokerCredential({
      accountId,
      providerId: body.providerId,
      credentialType: body.credentialType,
      encryptedValue: this.encryption.encrypt(body.value),
      encryptionKeyVersion: this.encryption.keyVersion(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });

    await recordAudit({
      actorUserId,
      accountId,
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
    account: Awaited<ReturnType<typeof listAccounts>>[number],
  ) {
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
