import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from '@ai-trading/configuration';
import { SessionAuthGuard } from './common/auth/session-auth.guard.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ConfigurationModule } from './modules/configuration/configuration.module.js';
import { DataModule } from './modules/data/data.module.js';
import { InstrumentsModule } from './modules/instruments/instruments.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { StrategiesModule } from './modules/strategies/strategies.module.js';
import { SystemControlModule } from './modules/system-control/system-control.module.js';
import { UniversesModule } from './modules/universes/universes.module.js';

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
    AuthModule,
    AccountsModule,
    InstrumentsModule,
    UniversesModule,
    StrategiesModule,
    ConfigurationModule,
    DataModule,
    AuditModule,
    SettingsModule,
    SystemControlModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
