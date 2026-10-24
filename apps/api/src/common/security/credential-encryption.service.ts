import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

@Injectable()
export class CredentialEncryptionService {
  constructor(private readonly config: ConfigService) {}

  keyVersion(): number {
    return VERSION;
  }

  encrypt(plaintext: string): Buffer {
    const key = this.key();
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, nonce);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from([VERSION]), nonce, tag, encrypted]);
  }

  decrypt(payload: Buffer): string {
    if (payload.length <= 1 + NONCE_BYTES + TAG_BYTES) {
      throw new Error('Encrypted credential payload is too short');
    }
    const version = payload[0];
    if (version !== VERSION) {
      throw new Error(`Unsupported credential encryption version ${version}`);
    }
    const nonce = payload.subarray(1, 1 + NONCE_BYTES);
    const tag = payload.subarray(1 + NONCE_BYTES, 1 + NONCE_BYTES + TAG_BYTES);
    const ciphertext = payload.subarray(1 + NONCE_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.key(), nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const configured = this.config.get<string>('CONFIG_ENCRYPTION_KEY');
    if (!configured) {
      throw new Error(
        'CONFIG_ENCRYPTION_KEY is required to store or read broker credentials',
      );
    }
    if (/^[0-9a-f]{64}$/i.test(configured)) {
      return Buffer.from(configured, 'hex');
    }
    const decoded = Buffer.from(configured, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
    // Development convenience: derive a stable 32-byte key from a passphrase.
    // Production deployments should supply 32 random bytes as hex or base64.
    return createHash('sha256').update(configured, 'utf8').digest();
  }
}
