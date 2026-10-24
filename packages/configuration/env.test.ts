import { describe, expect, it } from 'vitest';
import { assertOfflineMode, validateEnv } from './env.js';

describe('R1 environment', () => {
  it('defaults to offline, port 8000 and a 12-hour session', () => {
    const env = validateEnv({});
    expect(env.TRADING_MODE).toBe('offline');
    expect(env.API_PORT).toBe(8000);
    expect(env.SESSION_TTL_HOURS).toBe(12);
    expect(env.MARKET_TIMEZONE).toBe('Asia/Kolkata');
  });

  it('refuses to start outside offline mode', () => {
    expect(() => assertOfflineMode('live')).toThrow(/only supports TRADING_MODE=offline/);
    expect(() => assertOfflineMode('offline')).not.toThrow();
    expect(() => assertOfflineMode(undefined)).not.toThrow();
  });

  it('rejects an unknown trading mode', () => {
    expect(() => validateEnv({ TRADING_MODE: 'aggressive' })).toThrow(/Invalid option/i);
  });
});
