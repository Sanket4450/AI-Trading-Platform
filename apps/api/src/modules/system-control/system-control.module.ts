import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { SystemControlController } from './system-control.controller.js';
import { SystemControlService } from './system-control.service.js';

@Module({
  controllers: [SystemControlController, HealthController],
  providers: [SystemControlService],
})
export class SystemControlModule {}
