import { Module } from '@nestjs/common';
import { JobTrackingService } from './job-tracking.service.js';

@Module({
  providers: [JobTrackingService],
  exports: [JobTrackingService],
})
export class JobObservabilityModule {}
