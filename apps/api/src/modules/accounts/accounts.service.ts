import { Injectable, NotFoundException } from '@nestjs/common';
import {
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
    if (!accounts.some((account) => account.id === accountId)) {
      throw new NotFoundException('Account not found');
    }

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
}
