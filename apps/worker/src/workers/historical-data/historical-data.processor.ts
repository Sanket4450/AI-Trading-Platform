import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import { HistoricalDataService } from './historical-data.service.js';

@Processor(QUEUES.historicalData)
export class HistoricalDataProcessor extends WorkerHost {
  constructor(private readonly historicalData: HistoricalDataService) {
    super();
  }

  process(job: Job): Promise<unknown> {
    return this.historicalData.run(
      job.name,
      job.data as Record<string, unknown>,
    );
  }
}
