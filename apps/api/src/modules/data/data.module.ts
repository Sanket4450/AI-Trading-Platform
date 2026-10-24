import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { DataController } from './data.controller.js';
import { DataService } from './data.service.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.historicalData },
      { name: QUEUES.maintenance },
    ),
  ],
  controllers: [DataController],
  providers: [DataService],
})
export class DataModule {}
