import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { MarketScheduler } from './market.scheduler.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.historicalData },
      { name: QUEUES.maintenance },
    ),
  ],
  providers: [MarketScheduler],
})
export class SchedulersModule {}
