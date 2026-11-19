import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { BudgetStatusService } from './budget.service.js';
import { ProviderIssuesController } from './provider-issues.controller.js';
import { ProviderController } from './provider.controller.js';
import { ProviderIssueService } from './provider-issue.service.js';
import { ProviderService } from './provider.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

/**
 * Static route segments (`provider`, `issues`, `maintenance`, `trading-calendar`)
 * must be registered before SettingsController's `:key` patch route.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.historicalData },
      { name: QUEUES.maintenance },
    ),
  ],
  controllers: [ProviderController, ProviderIssuesController, SettingsController],
  providers: [
    SettingsService,
    ProviderService,
    ProviderIssueService,
    BudgetStatusService,
  ],
})
export class SettingsModule {}
