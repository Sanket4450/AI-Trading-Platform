import { Module } from '@nestjs/common';
import { TradingController } from './trading.controller.js';
import { TradingService } from './trading.service.js';

@Module({
  controllers: [TradingController],
  providers: [TradingService],
})
export class TradingModule {}
