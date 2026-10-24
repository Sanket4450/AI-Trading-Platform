import { Module } from '@nestjs/common';
import { MarketScheduler } from './market.scheduler.js';

@Module({
  providers: [MarketScheduler],
})
export class SchedulersModule {}
