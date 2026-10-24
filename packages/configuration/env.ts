import { z } from 'zod';

export const tradingModes = ['offline', 'research', 'backtesting', 'paper', 'live'] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('Asia/Kolkata'),
  MARKET_TIMEZONE: z.string().default('Asia/Kolkata'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api'),
  TRADING_MODE: z.enum(tradingModes).default('offline'),

  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(8).default('replace-me'),
  JWT_EXPIRES_IN: z.string().default('15m'),

  UPSTOX_API_KEY: z.string().optional(),
  UPSTOX_API_SECRET: z.string().optional(),
  UPSTOX_REDIRECT_URI: z.string().url().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().optional(),
  UPSTOX_SANDBOX: z.coerce.boolean().default(true),

  RISK_EQUITY: z.coerce.number().positive().default(100000),
  RISK_PER_TRADE_PCT: z.coerce.number().positive().default(0.5),
  DAILY_LOSS_LIMIT_PCT: z.coerce.number().positive().default(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
