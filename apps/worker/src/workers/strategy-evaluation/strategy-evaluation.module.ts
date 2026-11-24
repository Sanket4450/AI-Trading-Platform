import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { JobObservabilityModule } from '../../observability/observability.module.js';
import { StrategyEvaluationProcessor } from './strategy-evaluation.processor.js';
import { StrategyEvaluationService } from './strategy-evaluation.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.strategyEvaluation }),
    JobObservabilityModule,
  ],
  providers: [StrategyEvaluationService, StrategyEvaluationProcessor],
})
export class StrategyEvaluationModule {}
