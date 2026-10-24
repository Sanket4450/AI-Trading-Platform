import { Module } from '@nestjs/common';
import { BacktestExecutionService } from './backtest-execution.service.js';

@Module({
  providers: [BacktestExecutionService]
})
export class BacktestExecutionModule {}
