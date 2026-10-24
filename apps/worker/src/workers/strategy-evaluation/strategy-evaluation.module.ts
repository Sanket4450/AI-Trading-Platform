import { Module } from '@nestjs/common';
import { StrategyEvaluationService } from './strategy-evaluation.service.js';

@Module({
  providers: [StrategyEvaluationService],
})
export class StrategyEvaluationModule {}
