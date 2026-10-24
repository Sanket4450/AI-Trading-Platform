import { z } from 'zod';

export const tradingModes = ['offline', 'research', 'backtesting', 'paper', 'live'] as const;

const booleanFromEnv = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('Asia/Kolkata'),
  MARKET_TIMEZONE: z.string().default('Asia/Kolkata'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_PORT: z.coerce.number().int().positive().default(8000),
  API_PREFIX: z.string().default('api'),
  TRADING_MODE: z.enum(tradingModes).default('offline'),

  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(8).default('replace-me'),
  JWT_EXPIRES_IN: z.string().default('15m'),

  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  COOKIE_SECURE: booleanFromEnv.default(false),
  CONFIG_ENCRYPTION_KEY: z.string().optional(),

  UPSTOX_API_KEY: z.string().optional(),
  UPSTOX_API_SECRET: z.string().optional(),
  UPSTOX_REDIRECT_URI: z.string().url().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().optional(),
  UPSTOX_SANDBOX: booleanFromEnv.default(true),
  UPSTOX_NETWORK_ENABLED: booleanFromEnv.default(true),
  UPSTOX_INSTRUMENTS_URL: z
    .string()
    .url()
    .default('https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz'),

  DATA_BACKFILL_MAX_DAYS: z.coerce.number().int().positive().default(31),
  WORKER_SCHEDULES_ENABLED: booleanFromEnv.default(true),
  INSTRUMENT_SYNC_LIMIT: z.coerce.number().int().positive().default(5000),

  RISK_EQUITY: z.coerce.number().positive().default(100000),
  RISK_PER_TRADE_PCT: z.coerce.number().positive().default(0.5),
  DAILY_LOSS_LIMIT_PCT: z.coerce.number().positive().default(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}

/**
 * R1 is offline by construction. Refusing to start outside offline mode makes
 * the guarantee impossible to bypass with an environment change.
 */
export function assertOfflineMode(mode: string | undefined = process.env.TRADING_MODE): void {
  if ((mode ?? 'offline') !== 'offline') {
    throw new Error(
      `R1 only supports TRADING_MODE=offline. Refusing to start with TRADING_MODE=${mode}.`,
    );
  }
}
