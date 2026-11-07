import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { JobObservabilityModule } from '../../observability/observability.module.js';
import { MaintenanceProcessor } from './maintenance.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.maintenance }),
    JobObservabilityModule,
  ],
  providers: [MaintenanceProcessor],
})
export class MaintenanceModule {}
