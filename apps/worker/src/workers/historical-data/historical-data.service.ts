import { Injectable, Logger } from '@nestjs/common';
import { IngestionService } from './ingestion.service.js';
import { QualityService } from './quality.service.js';
import { ReferenceSyncService } from './reference-sync.service.js';

@Injectable()
export class HistoricalDataService {
  private readonly logger = new Logger(HistoricalDataService.name);

  constructor(
    private readonly reference: ReferenceSyncService,
    private readonly ingestion: IngestionService,
    private readonly quality: QualityService,
  ) {}

  async run(jobName: string, payload: Record<string, unknown>) {
    switch (jobName) {
      case 'historical-backfill': {
        const jobRunId = String(payload.jobRunId);
        const parentJobRunId =
          typeof payload.parentJobRunId === 'string'
            ? payload.parentJobRunId
            : jobRunId;
        return this.ingestion.runInstrumentBackfill({
          ...payload,
          parentJobRunId,
        });
      }
      case 'historical-finalize':
        return this.ingestion.historicalFinalize(
          String(payload.jobRunId),
          payload,
        );
      case 'intraday-sync':
        return this.ingestion.intradaySync(String(payload.jobRunId));
      case 'instrument-sync':
        return this.reference.instrumentSync(String(payload.jobRunId));
      case 'calendar-sync':
        return this.reference.calendarSync(String(payload.jobRunId));
      case 'coverage-recompute':
        return this.ingestion.coverageRecompute(
          String(payload.jobRunId),
          payload,
        );
      case 'quality-scan':
        return this.ingestion.qualityScanJob(String(payload.jobRunId), payload);
      case 'daily-validation':
        return this.ingestion.dailyValidationJob(
          String(payload.jobRunId),
          payload,
        );
      case 'ingestion-reconcile':
        return this.ingestion.ingestionReconcile(String(payload.jobRunId));
      default:
        this.logger.error(`Unknown historical-data job: ${jobName}`);
        throw new Error(`Unknown historical-data job: ${jobName}`);
    }
  }
}
