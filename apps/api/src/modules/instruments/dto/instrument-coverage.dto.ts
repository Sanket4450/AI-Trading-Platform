import { ApiProperty } from '@nestjs/swagger';
import { JobRunDto } from '../../../common/dto/job-run.dto.js';
import { QualityIssueDto } from '../../../common/dto/quality-issue.dto.js';

export class InstrumentCoverageSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  notRequested!: number;

  @ApiProperty()
  queued!: number;

  @ApiProperty()
  fetching!: number;

  @ApiProperty()
  fetched!: number;

  @ApiProperty()
  partialFetch!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  complete!: number;

  @ApiProperty()
  partialMismatch!: number;

  @ApiProperty()
  missing!: number;

  @ApiProperty()
  needsReview!: number;
}

export class InstrumentCoverageRowDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty()
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  isin!: string | null;

  @ApiProperty()
  segment!: string;

  @ApiProperty()
  instrumentType!: string;

  @ApiProperty()
  tickSize!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  listedOn!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  delistedOn!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  targetFrom!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  targetTo!: string | null;

  @ApiProperty({ type: String, nullable: true })
  fetchStatus!: string | null;

  @ApiProperty({ type: String, nullable: true })
  dataStatus!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  expectedDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  completeDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  partialDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  missingDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  notApplicableDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  openCriticalIssues!: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  lastRunId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  activeRunId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  computedAt!: string | null;

  @ApiProperty()
  mappingCount!: number;
}

export class InstrumentCoverageMonthDto {
  @ApiProperty({ example: '2026-01' })
  month!: string;

  @ApiProperty()
  complete!: number;

  @ApiProperty()
  partial!: number;

  @ApiProperty()
  missing!: number;

  @ApiProperty()
  notApplicable!: number;
}

export class IngestionRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', required: false })
  providerId?: string;

  @ApiProperty({ example: 'upstox' })
  providerCode!: string;

  @ApiProperty({ example: 'historical_backfill' })
  runType!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  instrumentId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  symbol!: string | null;

  @ApiProperty({ type: String, nullable: true })
  timeframeUnit!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  timeframeInterval!: number | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  requestedFrom!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  requestedTo!: string | null;

  @ApiProperty({
    enum: [
      'queued',
      'running',
      'succeeded',
      'partially_failed',
      'failed',
      'cancelled',
    ],
  })
  status!: string;

  @ApiProperty()
  rowsFetched!: number;

  @ApiProperty()
  rowsWritten!: number;

  @ApiProperty()
  rowsRejected!: number;

  @ApiProperty()
  rowsSkipped!: number;

  @ApiProperty()
  rowsUpdated!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentJobRunId!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  chunkIndex!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  chunkCount!: number | null;

  @ApiProperty()
  attempt!: number;

  @ApiProperty({ type: String, nullable: true })
  requestFingerprint!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  httpStatus!: number | null;

  @ApiProperty({ type: String, nullable: true })
  providerErrorCode!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  rateLimitedUntil!: string | null;

  @ApiProperty({ type: String, nullable: true })
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class RawProviderPayloadDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  endpoint!: string;

  @ApiProperty({ example: 200 })
  httpStatus!: number;

  @ApiProperty({ example: 84213 })
  payloadBytes!: number;

  @ApiProperty()
  payloadSha256!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  fetchedAt!: string;

  @ApiProperty({ enum: ['standard', 'extended', 'errors'] })
  retentionClass!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expiresAt!: string | null;
}

export class IngestionRunDetailDto extends IngestionRunDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
  })
  rawPayloadId?: string | null;

  @ApiProperty({ type: RawProviderPayloadDto, nullable: true })
  rawPayload!: RawProviderPayloadDto | null;
}

export class InstrumentCoverageDetailDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  isin!: string | null;

  @ApiProperty()
  segment!: string;

  @ApiProperty()
  instrumentType!: string;

  @ApiProperty()
  tickSize!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  listedOn!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  delistedOn!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  targetFrom!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  targetTo!: string | null;

  @ApiProperty({ type: String, nullable: true })
  fetchStatus!: string | null;

  @ApiProperty({ type: String, nullable: true })
  dataStatus!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  expectedDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  completeDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  partialDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  missingDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  notApplicableDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  openCriticalIssues!: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  lastRunId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  activeRunId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  computedAt!: string | null;

  @ApiProperty()
  mappingCount!: number;

  @ApiProperty({ type: [InstrumentCoverageMonthDto] })
  months!: InstrumentCoverageMonthDto[];

  @ApiProperty({ type: [IngestionRunDto] })
  runs!: IngestionRunDto[];

  @ApiProperty({ type: [QualityIssueDto] })
  issues!: QualityIssueDto[];
}

export class CoverageInstrumentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '0.05' })
  tickSize!: string;
}

export class CoverageDayDetailDto {
  @ApiProperty({ type: CoverageInstrumentDto, nullable: true })
  instrument!: CoverageInstrumentDto | null;

  @ApiProperty({
    type: Object,
    additionalProperties: true,
    nullable: true,
    description: 'Raw coverage row for the instrument/date pair.',
  })
  coverage!: Record<string, unknown> | null;

  @ApiProperty({ type: [QualityIssueDto] })
  issues!: QualityIssueDto[];
}

export class BlockedInstrumentDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty()
  symbol!: string;

  @ApiProperty({ example: 'mapping_missing' })
  reason!: string;
}

export class FetchMonthChunkDto {
  @ApiProperty()
  index!: number;

  @ApiProperty({ format: 'date' })
  from!: string;

  @ApiProperty({ format: 'date' })
  to!: string;
}

export class InstrumentFetchPreviewDto {
  @ApiProperty()
  instrumentCount!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty({ type: [BlockedInstrumentDto] })
  blocked!: BlockedInstrumentDto[];

  @ApiProperty()
  sessionCount!: number;

  @ApiProperty()
  monthCount!: number;

  @ApiProperty()
  skippedMonths!: number;

  @ApiProperty()
  requestCount!: number;

  @ApiProperty()
  estimatedBars!: number;

  @ApiProperty()
  estimatedBytes!: number;

  @ApiProperty({ format: 'date' })
  from!: string;

  @ApiProperty({ format: 'date' })
  to!: string;

  @ApiProperty({ type: [FetchMonthChunkDto] })
  months!: FetchMonthChunkDto[];
}

export class QueuedInstrumentDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty()
  symbol!: string;

  @ApiProperty({ format: 'uuid' })
  jobRunId!: string;

  @ApiProperty({ format: 'date' })
  from!: string;

  @ApiProperty({ format: 'date' })
  to!: string;
}

export class ExistingRunDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ format: 'uuid' })
  runId!: string;
}

export class InstrumentFetchResponseDto {
  @ApiProperty({
    description: 'True when no queue work was created (preview response).',
  })
  dryRun!: boolean;

  @ApiProperty({ type: InstrumentFetchPreviewDto })
  preview!: InstrumentFetchPreviewDto;

  @ApiProperty({ type: JobRunDto, nullable: true, required: false })
  plan?: JobRunDto | null;

  @ApiProperty({ type: [QueuedInstrumentDto], required: false })
  queued?: QueuedInstrumentDto[];

  @ApiProperty({ type: [ExistingRunDto], required: false })
  existingRunIds?: ExistingRunDto[];
}

export class CancelInstrumentFetchDto {
  @ApiProperty({ format: 'uuid' })
  planId!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'cancelled' })
  status!: string;
}

export class CorporateActionImportRowResultDto {
  @ApiProperty()
  row!: number;

  @ApiProperty()
  ok!: boolean;

  @ApiProperty({ type: String, required: false })
  error?: string;

  @ApiProperty({ type: String, format: 'uuid', required: false })
  instrumentId?: string;

  @ApiProperty({
    enum: ['inserted', 'updated', 'unchanged'],
    required: false,
  })
  action?: 'inserted' | 'updated' | 'unchanged';
}

export class CorporateActionImportResultDto {
  @ApiProperty()
  dryRun!: boolean;

  @ApiProperty({ type: [CorporateActionImportRowResultDto] })
  results!: CorporateActionImportRowResultDto[];

  @ApiProperty()
  imported!: number;

  @ApiProperty()
  updated!: number;
}
