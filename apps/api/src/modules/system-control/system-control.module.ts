import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { HealthController } from './health.controller.js';
import { SystemControlController } from './system-control.controller.js';
import { SystemControlService } from './system-control.service.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.historicalData },
      { name: QUEUES.maintenance },
    ),
  ],
  controllers: [HealthController, SystemControlController],
  providers: [SystemControlService],
  exports: [SystemControlService],
})
export class SystemControlModule {}
