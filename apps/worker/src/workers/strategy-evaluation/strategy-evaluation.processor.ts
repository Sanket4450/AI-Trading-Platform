import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUES } from '@ai-trading/domain';
import { JobTrackingService } from '../../observability/job-tracking.service.js';
import { StrategyEvaluationService } from './strategy-evaluation.service.js';

@Processor(QUEUES.strategyEvaluation, { concurrency: 1 })
export class StrategyEvaluationProcessor extends WorkerHost {
  constructor(
    private readonly evaluation: StrategyEvaluationService,
    private readonly tracking: JobTrackingService,
  ) {
    super();
  }

  process(job: Job): Promise<unknown> {
    return this.tracking.run(job, () =>
      this.evaluation.run(job.name, job.data as Record<string, unknown>),
    );
  }
}
