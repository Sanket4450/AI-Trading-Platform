import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '@ai-trading/domain';
import { InstrumentCoverageController } from './instrument-coverage.controller.js';
import { InstrumentIssuesController } from './instrument-issues.controller.js';
import { InstrumentsController } from './instruments.controller.js';
import { InstrumentCoverageService } from './instrument-coverage.service.js';
import { InstrumentIngestionService } from './instrument-ingestion.service.js';
import { InstrumentIssuesService } from './instrument-issues.service.js';
import { InstrumentReferenceService } from './instrument-reference.service.js';
import { InstrumentsService } from './instruments.service.js';

/**
 * Static route segments (`status`, `issues`) must be registered before the
 * `:id` routes in InstrumentsController.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.historicalData })],
  controllers: [
    InstrumentCoverageController,
    InstrumentIssuesController,
    InstrumentsController,
  ],
  providers: [
    InstrumentsService,
    InstrumentCoverageService,
    InstrumentIngestionService,
    InstrumentIssuesService,
    InstrumentReferenceService,
  ],
})
export class InstrumentsModule {}
