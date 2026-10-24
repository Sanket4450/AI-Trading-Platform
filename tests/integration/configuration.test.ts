import { describe, expect, it } from 'vitest';
import { validateEnv } from '@ai-trading/configuration';

describe('configuration contract', () => {
  it('defaults to offline trading with the expected API port', () => {
    const env = validateEnv({});

    expect(env.TRADING_MODE).toBe('offline');
    expect(env.API_PORT).toBe(8000);
    expect(env.MARKET_TIMEZONE).toBe('Asia/Kolkata');
  });

  it('rejects an unknown trading mode', () => {
    expect(() => validateEnv({ TRADING_MODE: 'aggressive' })).toThrow();
  });

  it('parses the sandbox flag as a real boolean', () => {
    expect(validateEnv({ UPSTOX_SANDBOX: 'false' }).UPSTOX_SANDBOX).toBe(false);
    expect(validateEnv({ UPSTOX_SANDBOX: 'true' }).UPSTOX_SANDBOX).toBe(true);
  });
});
