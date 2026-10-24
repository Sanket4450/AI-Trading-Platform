import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { CredentialEncryptionService } from './credential-encryption.service.js';

function service(key: string | undefined): CredentialEncryptionService {
  const config = {
    get: (name: string) => (name === 'CONFIG_ENCRYPTION_KEY' ? key : undefined),
  } as unknown as ConfigService;
  return new CredentialEncryptionService(config);
}

describe('CredentialEncryptionService', () => {
  const key = 'a'.repeat(64);

  it('round-trips a secret with AES-256-GCM', () => {
    const encryption = service(key);
    const ciphertext = encryption.encrypt('upstox-access-token');
    expect(ciphertext).toBeInstanceOf(Buffer);
    expect(ciphertext.toString('utf8')).not.toContain('upstox-access-token');
    expect(encryption.decrypt(ciphertext)).toBe('upstox-access-token');
  });

  it('rejects tampered ciphertext', () => {
    const encryption = service(key);
    const ciphertext = encryption.encrypt('secret');
    ciphertext[ciphertext.length - 1] =
      ciphertext[ciphertext.length - 1]! ^ 0xff;
    expect(() => encryption.decrypt(ciphertext)).toThrow(/authenticate|state/i);
  });

  it('requires a configured key', () => {
    expect(() => service(undefined).encrypt('secret')).toThrow(
      /CONFIG_ENCRYPTION_KEY/,
    );
  });
});
