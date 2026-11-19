import { Module } from '@nestjs/common';
import { JobEventsPublisher } from './job-events.publisher.js';
import { JobStoreService } from './job-store.js';
import { JobTrackingService } from './job-tracking.service.js';

@Module({
  providers: [JobEventsPublisher, JobStoreService, JobTrackingService],
  exports: [JobTrackingService, JobStoreService],
})
export class JobObservabilityModule {}
