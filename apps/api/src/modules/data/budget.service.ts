import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class BudgetStatusService implements OnModuleDestroy {
  private readonly logger = new Logger(BudgetStatusService.name);
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    );
  }

  async state() {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const [second, minute, thirty, pause] = await Promise.all([
        this.redis.zcard('upstox:budget:second'),
        this.redis.zcard('upstox:budget:minute'),
        this.redis.zcard('upstox:budget:30m'),
        this.redis.pttl('upstox:budget:pause'),
      ]);
      return {
        availableSecond: Math.max(
          0,
          this.config.get<number>('UPSTOX_RATE_LIMIT_PER_SECOND', 40) - second,
        ),
        availableMinute: Math.max(
          0,
          this.config.get<number>('UPSTOX_RATE_LIMIT_PER_MINUTE', 400) - minute,
        ),
        available30Minutes: Math.max(
          0,
          this.config.get<number>('UPSTOX_RATE_LIMIT_PER_30_MINUTES', 1600) -
            thirty,
        ),
        pausedUntil:
          pause > 0 ? new Date(Date.now() + pause).toISOString() : null,
      };
    } catch (error) {
      this.logger.warn(`Budget state unavailable: ${String(error)}`);
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
