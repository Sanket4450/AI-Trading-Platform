import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { JOB_EVENTS_CHANNEL, type JobBroadcast } from '@ai-trading/domain';

/**
 * Best-effort fan-out of ledger changes. The dashboard treats these messages as hints:
 * a missed publish only delays a refresh until the next event.
 */
@Injectable()
export class JobEventsPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(JobEventsPublisher.name);
  private readonly redis: Redis;
  private reported = false;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      { maxRetriesPerRequest: 1 },
    );
    this.redis.on('error', (error) => this.report(error));
  }

  publish(message: JobBroadcast): void {
    void this.redis
      .publish(JOB_EVENTS_CHANNEL, JSON.stringify(message))
      .catch((error) => this.report(error));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  private report(error: unknown): void {
    if (this.reported) return;
    this.reported = true;
    this.logger.warn(
      `Job event fan-out degraded: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
