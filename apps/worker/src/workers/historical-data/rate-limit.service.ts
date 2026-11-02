import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type {
  RateLimitConfig,
  RateLimitState,
  RateLimiter,
} from '@ai-trading/adapters';

const KEYS = {
  second: 'upstox:budget:second',
  minute: 'upstox:budget:minute',
  thirtyMinutes: 'upstox:budget:30m',
  pause: 'upstox:budget:pause',
} as const;

const ACQUIRE_SCRIPT = `
local now = redis.call('TIME')
local nowMs = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
local paused = redis.call('GET', KEYS[4])
if paused then
  return math.max(1, tonumber(paused) - nowMs)
end
local windows = {1000, 60000, 1800000}
local limits = {tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])}
local wait = 0
for i = 1, 3 do
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', nowMs - windows[i])
  local count = redis.call('ZCARD', KEYS[i])
  if count >= limits[i] then
    local oldest = redis.call('ZRANGE', KEYS[i], 0, 0, 'WITHSCORES')
    local oldestScore = tonumber(oldest[2])
    local candidate = oldestScore + windows[i] - nowMs
    if candidate > wait then wait = candidate end
  end
end
if wait > 0 then return wait end
for i = 1, 3 do
  redis.call('ZADD', KEYS[i], nowMs, ARGV[4])
  redis.call('PEXPIRE', KEYS[i], windows[i] + 1000)
end
return 0
`;

/**
 * One Redis-backed budget shared by every worker process. The limiter is
 * global to the provider account, not per process, so four workers cannot
 * each claim the full rate.
 */
@Injectable()
export class RedisRateLimiter implements RateLimiter, OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimiter.name);
  private readonly redis: Redis;
  private readonly config: RateLimitConfig;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
      },
    );
    this.config = {
      perSecond: config.get<number>('UPSTOX_RATE_LIMIT_PER_SECOND', 40),
      perMinute: config.get<number>('UPSTOX_RATE_LIMIT_PER_MINUTE', 400),
      per30Minutes: config.get<number>(
        'UPSTOX_RATE_LIMIT_PER_30_MINUTES',
        1600,
      ),
    };
  }

  async acquire(): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect();
    for (;;) {
      const member = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const result = await this.redis.eval(
        ACQUIRE_SCRIPT,
        4,
        KEYS.second,
        KEYS.minute,
        KEYS.thirtyMinutes,
        KEYS.pause,
        String(this.config.perSecond),
        String(this.config.perMinute),
        String(this.config.per30Minutes),
        member,
      );
      const wait = Number(result);
      if (wait <= 0) return;
      this.logger.debug(`Provider budget wait ${Math.round(wait)}ms`);
      await new Promise((resolve) => setTimeout(resolve, Math.max(10, wait)));
    }
  }

  async pause(milliseconds: number): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect();
    await this.redis.set(
      KEYS.pause,
      String(Date.now() + milliseconds),
      'PX',
      milliseconds,
    );
  }

  async state(): Promise<RateLimitState> {
    if (this.redis.status === 'wait') await this.redis.connect();
    const [second, minute, thirty, pause] = await Promise.all([
      this.redis.zcard(KEYS.second),
      this.redis.zcard(KEYS.minute),
      this.redis.zcard(KEYS.thirtyMinutes),
      this.redis.pttl(KEYS.pause),
    ]);
    return {
      pausedUntil: pause > 0 ? Date.now() + pause : null,
      availableSecond: Math.max(0, this.config.perSecond - second),
      availableMinute: Math.max(0, this.config.perMinute - minute),
      available30Minutes: Math.max(0, this.config.per30Minutes - thirty),
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
