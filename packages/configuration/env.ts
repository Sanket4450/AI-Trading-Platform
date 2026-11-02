import { z } from 'zod';

export const tradingModes = ['offline', 'research', 'backtesting', 'paper', 'live'] as const;
export const researchModes = ['offline', 'research'] as const;

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
  UPSTOX_BASE_URL: z.string().url().default('https://api.upstox.com'),
  UPSTOX_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  UPSTOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  UPSTOX_RATE_LIMIT_PER_SECOND: z.coerce.number().int().positive().default(40),
  UPSTOX_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(400),
  UPSTOX_RATE_LIMIT_PER_30_MINUTES: z.coerce.number().int().positive().default(1600),
  UPSTOX_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),
  UPSTOX_INSTRUMENTS_URL: z
    .string()
    .url()
    .default('https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz'),

  DATA_BACKFILL_MAX_DAYS: z.coerce.number().int().positive().default(31),
  DATA_BACKFILL_CHUNK_MONTHS: z.coerce.number().int().positive().default(1),
  DATA_BACKFILL_MAX_INSTRUMENTS: z.coerce.number().int().positive().default(100),
  DATA_QUALITY_MAX_GAP_MINUTES: z.coerce.number().int().positive().default(5),
  DATA_QUALITY_VOLUME_TOLERANCE_PCT: z.coerce.number().min(0).default(0.02),
  DATA_QUALITY_STALE_HOURS: z.coerce.number().int().positive().default(24),
  DATA_STATUS_STALE_SESSIONS: z.coerce.number().int().positive().default(1),
  DATA_VALIDATION_DAILY_ORACLE: booleanFromEnv.default(true),
  DATA_RETENTION_RAW_DAYS: z.coerce.number().int().positive().default(365),
  WORKER_SCHEDULES_ENABLED: booleanFromEnv.default(true),
  INSTRUMENT_SYNC_LIMIT: z.coerce.number().int().positive().default(20_000),

  RISK_EQUITY: z.coerce.number().positive().default(100000),
  RISK_PER_TRADE_PCT: z.coerce.number().positive().default(0.5),
  DAILY_LOSS_LIMIT_PCT: z.coerce.number().positive().default(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}

/**
 * R2 is a research capability, not a trading capability. Accepting only
 * offline and research makes paper/live unreachable from an environment change.
 */
export function assertResearchMode(mode: string | undefined = process.env.TRADING_MODE): void {
  const resolved = mode ?? 'offline';
  if (!(researchModes as readonly string[]).includes(resolved)) {
    throw new Error(
      `R2 only supports TRADING_MODE=offline or research. Refusing to start with TRADING_MODE=${resolved}.`,
    );
  }
}

/** R1 compatibility alias. R2 callers should use assertResearchMode. */
export function assertOfflineMode(mode: string | undefined = process.env.TRADING_MODE): void {
  assertResearchMode(mode);
}
