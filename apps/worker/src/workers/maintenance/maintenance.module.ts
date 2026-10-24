import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { MaintenanceProcessor } from './maintenance.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.maintenance })],
  providers: [MaintenanceProcessor],
})
export class MaintenanceModule {}
