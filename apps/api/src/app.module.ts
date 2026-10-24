import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv } from '@ai-trading/configuration';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { StrategiesModule } from './modules/strategies/strategies.module.js';
import { BacktestsModule } from './modules/backtests/backtests.module.js';
import { MarketDataModule } from './modules/market-data/market-data.module.js';
import { TradingModule } from './modules/trading/trading.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { RiskModule } from './modules/risk/risk.module.js';
import { PositionsModule } from './modules/positions/positions.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { SystemControlModule } from './modules/system-control/system-control.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
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
    StrategiesModule,
    BacktestsModule,
    MarketDataModule,
    TradingModule,
    OrdersModule,
    RiskModule,
    PositionsModule,
    ReportsModule,
    NotificationsModule,
    SystemControlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
