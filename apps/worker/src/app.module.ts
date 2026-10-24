import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from '@ai-trading/configuration';
import { QueuesModule } from './queues/queues.module.js';
import { SchedulersModule } from './schedulers/schedulers.module.js';
import { HistoricalDataModule } from './workers/historical-data/historical-data.module.js';
import { MaintenanceModule } from './workers/maintenance/maintenance.module.js';

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
    ScheduleModule.forRoot(),
    QueuesModule,
    SchedulersModule,
    HistoricalDataModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
