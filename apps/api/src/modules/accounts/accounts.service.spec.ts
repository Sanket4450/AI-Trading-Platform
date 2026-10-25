import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  listAccounts: vi.fn<() => Promise<unknown[]>>(),
  findProviderById: vi.fn<() => Promise<{ id: string; kind: string } | null>>(),
  upsertBrokerCredential: vi.fn<() => Promise<unknown>>(),
  recordAudit: vi.fn<() => Promise<void>>(),
}));

vi.mock('@ai-trading/database', () => ({
  listAccounts: db.listAccounts,
  findProviderById: db.findProviderById,
  upsertBrokerCredential: db.upsertBrokerCredential,
  recordAudit: db.recordAudit,
  listAccountAccessByAccount: vi.fn<() => Promise<unknown>>(),
  listAccountEquitySnapshots: vi.fn<() => Promise<unknown>>(),
  listAccountPermissions: vi.fn<() => Promise<unknown>>(),
  listBrokerCredentials: vi.fn<() => Promise<unknown>>(),
  listTradingSessions: vi.fn<() => Promise<unknown>>(),
}));

import type { CredentialEncryptionService } from '../../common/security/credential-encryption.service.js';
import { AccountsService } from './accounts.service.js';
import type { CreateCredentialDto } from './dto/create-credential.dto.js';

const body: CreateCredentialDto = {
  providerId: '11111111-1111-1111-1111-111111111111',
  credentialType: 'access_token',
  value: 'upstox-access-token',
};

function service() {
  const encryption = {
    encrypt: (value: string) => Buffer.from(value),
    keyVersion: () => 1,
  } as unknown as CredentialEncryptionService;
  return new AccountsService(encryption);
}

function store(accounts: unknown[]) {
  db.listAccounts.mockResolvedValue(accounts);
  return service().storeCredential(
    '22222222-2222-2222-2222-222222222222',
    body,
    '33333333-3333-3333-3333-333333333333',
    'request-id',
    '127.0.0.1',
    'vitest',
  );
}

const account = {
  id: '22222222-2222-2222-2222-222222222222',
  code: 'upstox-primary',
  brokerProviderId: '44444444-4444-4444-4444-444444444444',
  brokerUserRef: null,
};

describe('AccountsService credential validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.upsertBrokerCredential.mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      credentialType: body.credentialType,
      providerId: body.providerId,
      encryptionKeyVersion: 1,
      expiresAt: null,
    });
  });

  it('rejects credentials for a broker account without a broker_user_ref', async () => {
    db.findProviderById.mockResolvedValue({
      id: account.brokerProviderId,
      kind: 'both',
    });

    await expect(store([account])).rejects.toBeInstanceOf(BadRequestException);
    expect(db.upsertBrokerCredential).not.toHaveBeenCalled();
  });

  it('stores credentials for a broker account with a broker_user_ref', async () => {
    db.findProviderById.mockResolvedValue({
      id: account.brokerProviderId,
      kind: 'broker',
    });

    await store([{ ...account, brokerUserRef: 'ABC123' }]);

    expect(db.upsertBrokerCredential).toHaveBeenCalledOnce();
  });

  it('does not require a broker_user_ref for non-broker providers', async () => {
    db.findProviderById.mockResolvedValue({
      id: account.brokerProviderId,
      kind: 'internal',
    });

    await store([account]);

    expect(db.upsertBrokerCredential).toHaveBeenCalledOnce();
  });
});
