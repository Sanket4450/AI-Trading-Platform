import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { BackfillPlanService } from './backfill-plan.service.js';
import { BackfillPlansController } from './backfill-plans.controller.js';
import { BudgetStatusService } from './budget.service.js';
import { CatalogService } from './catalog.service.js';
import { DataController } from './data.controller.js';
import { DataService } from './data.service.js';
import { InstrumentStatusController } from './instrument-status.controller.js';
import { ReferenceDataController } from './reference-data.controller.js';
import { ReferenceDataService } from './reference-data.service.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.historicalData },
      { name: QUEUES.maintenance },
    ),
  ],
  controllers: [
    DataController,
    InstrumentStatusController,
    BackfillPlansController,
    ReferenceDataController,
  ],
  providers: [
    DataService,
    CatalogService,
    BackfillPlanService,
    ReferenceDataService,
    BudgetStatusService,
  ],
})
export class DataModule {}
