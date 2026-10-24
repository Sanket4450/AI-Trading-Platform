import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { QueuesModule } from './queues/queues.module.js';
import { SchedulersModule } from './schedulers/schedulers.module.js';
import { HistoricalDataModule } from './workers/historical-data/historical-data.module.js';
import { LiveMarketDataModule } from './workers/live-market-data/live-market-data.module.js';
import { StrategyEvaluationModule } from './workers/strategy-evaluation/strategy-evaluation.module.js';
import { BacktestExecutionModule } from './workers/backtest-execution/backtest-execution.module.js';
import { OrderReconciliationModule } from './workers/order-reconciliation/order-reconciliation.module.js';
import { PostTradeAnalyticsModule } from './workers/post-trade-analytics/post-trade-analytics.module.js';
import { EndOfDaySquareOffModule } from './workers/end-of-day-square-off/end-of-day-square-off.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(
          config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        );
        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(redisUrl.port || 6379),
            username: redisUrl.username || undefined,
            password: redisUrl.password || undefined,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    QueuesModule,
    SchedulersModule,
    HistoricalDataModule,
    LiveMarketDataModule,
    StrategyEvaluationModule,
    BacktestExecutionModule,
    OrderReconciliationModule,
    PostTradeAnalyticsModule,
    EndOfDaySquareOffModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
