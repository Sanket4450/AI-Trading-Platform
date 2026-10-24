import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { HistoricalDataProcessor } from './historical-data.processor.js';
import { HistoricalDataService } from './historical-data.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.historicalData })],
  providers: [HistoricalDataService, HistoricalDataProcessor],
})
export class HistoricalDataModule {}
