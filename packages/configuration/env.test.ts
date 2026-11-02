import { describe, expect, it } from 'vitest';
import { assertOfflineMode, assertResearchMode, validateEnv } from './env.js';

describe('R2 environment', () => {
  it('defaults to offline, port 8000 and a 12-hour session', () => {
    const env = validateEnv({});
    expect(env.TRADING_MODE).toBe('offline');
    expect(env.API_PORT).toBe(8000);
    expect(env.SESSION_TTL_HOURS).toBe(12);
    expect(env.MARKET_TIMEZONE).toBe('Asia/Kolkata');
    expect(env.UPSTOX_RATE_LIMIT_PER_SECOND).toBe(40);
    expect(env.DATA_BACKFILL_CHUNK_MONTHS).toBe(1);
  });

  it('accepts offline and research only', () => {
    expect(() => assertResearchMode('offline')).not.toThrow();
    expect(() => assertResearchMode('research')).not.toThrow();
    expect(() => assertResearchMode(undefined)).not.toThrow();
    for (const mode of ['backtesting', 'paper', 'live']) {
      expect(() => assertResearchMode(mode)).toThrow(/offline or research/);
    }
  });

  it('keeps the R1 alias compatible', () => {
    expect(() => assertOfflineMode('research')).not.toThrow();
    expect(() => assertOfflineMode('live')).toThrow(/offline or research/);
  });

  it('rejects an unknown trading mode', () => {
    expect(() => validateEnv({ TRADING_MODE: 'aggressive' })).toThrow(/Invalid option/i);
  });
});
