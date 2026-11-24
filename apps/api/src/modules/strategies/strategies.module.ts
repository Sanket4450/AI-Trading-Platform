import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { StrategiesController } from './strategies.controller.js';
import { StrategiesService } from './strategies.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.strategyEvaluation })],
  controllers: [StrategiesController],
  providers: [StrategiesService],
})
export class StrategiesModule {}
