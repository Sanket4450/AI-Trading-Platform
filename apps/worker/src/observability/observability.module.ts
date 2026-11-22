import { Module } from '@nestjs/common';
import { ExternalApiRecorder } from './external-api-recorder.js';
import { JobEventsPublisher } from './job-events.publisher.js';
import { JobStoreService } from './job-store.js';
import { JobTrackingService } from './job-tracking.service.js';

@Module({
  providers: [JobEventsPublisher, JobStoreService, JobTrackingService, ExternalApiRecorder],
  exports: [JobTrackingService, JobStoreService, ExternalApiRecorder],
})
export class JobObservabilityModule {}
