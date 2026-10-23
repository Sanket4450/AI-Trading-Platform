import { Module } from '@nestjs/common';
import { BacktestsController } from './backtests.controller.js';
import { BacktestsService } from './backtests.service.js';

@Module({
  controllers: [BacktestsController],
  providers: [BacktestsService]
})
export class BacktestsModule {}
