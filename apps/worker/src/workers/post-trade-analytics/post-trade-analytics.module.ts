import { Module } from '@nestjs/common';
import { PostTradeAnalyticsService } from './post-trade-analytics.service.js';

@Module({
  providers: [PostTradeAnalyticsService]
})
export class PostTradeAnalyticsModule {}
