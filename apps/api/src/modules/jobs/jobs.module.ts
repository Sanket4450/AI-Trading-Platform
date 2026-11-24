import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { AuthModule } from '../auth/auth.module.js';
import { JobsController } from './jobs.controller.js';
import { JobEventsPublisher } from './jobs-events.publisher.js';
import { JobsGateway } from './jobs.gateway.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue(
      { name: QUEUES.historicalData },
      { name: QUEUES.maintenance },
      { name: QUEUES.strategyEvaluation },
    ),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsGateway, JobEventsPublisher],
})
export class JobsModule {}
