import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import { JobTrackingService } from '../../observability/job-tracking.service.js';
import { HistoricalDataService } from './historical-data.service.js';

@Processor(QUEUES.historicalData, { concurrency: 4 })
export class HistoricalDataProcessor extends WorkerHost {
  constructor(
    private readonly historicalData: HistoricalDataService,
    private readonly tracking: JobTrackingService,
  ) {
    super();
  }

  process(job: Job): Promise<unknown> {
    return this.tracking.run(job, () =>
      this.historicalData.run(job.name, job.data as Record<string, unknown>),
    );
  }
}
