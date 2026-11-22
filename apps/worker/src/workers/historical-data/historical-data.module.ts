import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { JobObservabilityModule } from '../../observability/observability.module.js';
import { HistoricalDataProcessor } from './historical-data.processor.js';
import { HistoricalDataService } from './historical-data.service.js';
import { IngestionService } from './ingestion.service.js';
import { QualityService } from './quality.service.js';
import { RedisRateLimiter } from './rate-limit.service.js';
import { ReferenceSyncService } from './reference-sync.service.js';
import { StaleJobSweeper } from './stale-job.sweeper.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.historicalData },
      { name: QUEUES.maintenance },
    ),
    JobObservabilityModule,
  ],
  providers: [
    ReferenceSyncService,
    QualityService,
    RedisRateLimiter,
    IngestionService,
    HistoricalDataService,
    HistoricalDataProcessor,
    StaleJobSweeper,
  ],
  exports: [QualityService, RedisRateLimiter],
})
export class HistoricalDataModule {}
