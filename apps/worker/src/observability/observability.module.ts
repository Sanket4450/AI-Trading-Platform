import { Module } from '@nestjs/common';
import { ProcessTrackingService } from './process-tracking.service.js';

@Module({
  providers: [ProcessTrackingService],
  exports: [ProcessTrackingService],
})
export class ProcessObservabilityModule {}
