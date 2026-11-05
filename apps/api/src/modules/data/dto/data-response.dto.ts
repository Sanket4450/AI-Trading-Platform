import { ApiProperty } from '@nestjs/swagger';
import { JobRunDto } from '../../../common/dto/job-run.dto.js';

const VALIDATION_STATUSES = [
  'matched',
  'volume_reconciled',
  'volume_mismatch',
  'ohlc_mismatch',
  'daily_missing',
  'minute_missing',
  'error',
] as const;

export class CoverageRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty({ example: 375 })
  expectedBars!: number;

  @ApiProperty({ example: 375 })
  storedBars!: number;

  @ApiProperty({ example: 0 })
  gapCount!: number;

  @ApiProperty({ example: 0 })
  gapRunCount!: number;

  @ApiProperty({ example: 0 })
  maxGapMinutes!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  firstBarAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastBarAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  dailyVolume!: string | null;

  @ApiProperty({ type: String, nullable: true })
  minuteVolume!: string | null;

  @ApiProperty({ type: String, nullable: true })
  volumeDeltaPct!: string | null;

  @ApiProperty({ type: Boolean, nullable: true })
  ohlcMatch!: boolean | null;

  @ApiProperty({
    enum: [
      'not_checked',
      'pending',
      'matched',
      'volume_reconciled',
      'volume_mismatch',
      'ohlc_mismatch',
      'daily_missing',
      'minute_missing',
      'error',
    ],
  })
  validationStatus!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({ enum: ['complete', 'partial', 'missing', 'not_applicable'] })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  checkedAt!: string;
}

export class CoverageSummaryDto {
  @ApiProperty()
  complete!: number;

  @ApiProperty()
  partial!: number;

  @ApiProperty()
  missing!: number;

  @ApiProperty()
  notApplicable!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'number' },
    example: { matched: 40, volume_reconciled: 10 },
  })
  validation!: Record<string, number>;
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

export class QualityIssueDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, required: false })
  providerCode!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  instrumentId!: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  symbol!: string | null;

  @ApiProperty({ example: 'volume_mismatch' })
  issueType!: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  severity!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  tradingDate!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  windowStart!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  windowEnd!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({
    enum: ['open', 'acknowledged', 'resolved', 'ignored'],
  })
  status!: string;

  @ApiProperty({ example: 'daily_oracle' })
  detectedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  detectedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ruleId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  dedupeKey!: string | null;

  @ApiProperty()
  occurrenceCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  lastSeenAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  acknowledgedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acknowledgedAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resolutionNote!: string | null;
}

export class DailyStatDto {
  @ApiProperty({ format: 'uuid' })
  instrument_id!: string;

  @ApiProperty({ format: 'date' })
  trading_date!: string;

  @ApiProperty()
  open!: string;

  @ApiProperty()
  high!: string;

  @ApiProperty()
  low!: string;

  @ApiProperty()
  close!: string;

  @ApiProperty()
  volume!: string;

  @ApiProperty()
  traded_value!: string;

  @ApiProperty({ type: String, nullable: true })
  vwap_approx!: string | null;

  @ApiProperty()
  bar_count!: number;
}

export class DailyValidationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty({ enum: [...VALIDATION_STATUSES] })
  status!: string;

  @ApiProperty({ type: Boolean, nullable: true })
  ohlcMatch!: boolean | null;

  @ApiProperty({ type: Boolean, nullable: true })
  volumeMatch!: boolean | null;

  @ApiProperty({ type: String, nullable: true })
  dailyVolume!: string | null;

  @ApiProperty({ type: String, nullable: true })
  minuteVolume!: string | null;

  @ApiProperty({ type: String, nullable: true })
  volumeDeltaPct!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  checkedAt!: string;
}

export class CoverageHeatmapCellDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  rank!: number;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty({ enum: ['complete', 'partial', 'missing', 'not_applicable'] })
  status!: string;

  @ApiProperty()
  validationStatus!: string;

  @ApiProperty()
  gapCount!: number;

  @ApiProperty()
  gapRunCount!: number;

  @ApiProperty()
  maxGapMinutes!: number;
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

  @ApiProperty({
    type: Object,
    additionalProperties: true,
    nullable: true,
    description: 'Latest daily validation row for the instrument/date pair.',
  })
  validation!: Record<string, unknown> | null;

  @ApiProperty({ type: [QualityIssueDto] })
  issues!: QualityIssueDto[];
}

export class ProviderBudgetDto {
  @ApiProperty()
  availableSecond!: number;

  @ApiProperty()
  availableMinute!: number;

  @ApiProperty()
  available30Minutes!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pausedUntil!: string | null;
}

export class ProviderStatusDto {
  @ApiProperty({ example: 'upstox' })
  provider!: string;

  @ApiProperty()
  networkEnabled!: boolean;

  @ApiProperty()
  apiKeyConfigured!: boolean;

  @ApiProperty()
  tokenConfigured!: boolean;

  @ApiProperty()
  baseUrl!: string;

  @ApiProperty()
  dailyOracleEnabled!: boolean;

  @ApiProperty({ type: ProviderBudgetDto, nullable: true })
  budget!: ProviderBudgetDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulSyncAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulBackfillAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulIntradayAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulValidationAt!: string | null;

  @ApiProperty()
  failedRuns24h!: number;

  @ApiProperty()
  runningChunks!: number;

  @ApiProperty()
  queuedChunks!: number;

  @ApiProperty()
  payloadCount!: number;

  @ApiProperty({ example: '12345678', oneOf: [{ type: 'string' }, { type: 'number' }] })
  payloadBytes!: string | number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  oldestPayloadAt!: string | null;
}

export class QualityRuleDto {
  @ApiProperty({ example: 'DQ-001' })
  ruleId!: string;

  @ApiProperty({ example: 'missing_bar' })
  issueType!: string;

  @ApiProperty({ example: 'completeness' })
  dimension!: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  defaultSeverity!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  blocksPreflightWhenCritical!: boolean;
}

export class CatalogSummaryDto {
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
  partialReconciled!: number;

  @ApiProperty()
  partialMismatch!: number;

  @ApiProperty()
  missing!: number;

  @ApiProperty()
  needsReview!: number;
}

export class InstrumentStatusRowDto {
  @ApiProperty()
  rank!: number;

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

  @ApiProperty()
  universeCode!: string;

  @ApiProperty({ format: 'uuid' })
  universeVersionId!: string;

  @ApiProperty()
  universeVersion!: number;

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

export class InstrumentStatusMonthDto {
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

  @ApiProperty()
  reconciled!: number;

  @ApiProperty()
  mismatch!: number;
}

export class InstrumentStatusDetailDto {
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

  @ApiProperty({ type: [InstrumentStatusMonthDto] })
  months!: InstrumentStatusMonthDto[];

  @ApiProperty({ type: [IngestionRunDto] })
  runs!: IngestionRunDto[];

  @ApiProperty({ type: [QualityIssueDto] })
  issues!: QualityIssueDto[];
}

export class BackfillBlockedInstrumentDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty()
  symbol!: string;

  @ApiProperty({ example: 'mapping_missing' })
  reason!: string;
}

export class BackfillMonthChunkDto {
  @ApiProperty()
  index!: number;

  @ApiProperty({ format: 'date' })
  from!: string;

  @ApiProperty({ format: 'date' })
  to!: string;
}

export class BackfillPreviewDto {
  @ApiProperty()
  instrumentCount!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty({ type: [BackfillBlockedInstrumentDto] })
  blocked!: BackfillBlockedInstrumentDto[];

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

  @ApiProperty({ type: [BackfillMonthChunkDto] })
  months!: BackfillMonthChunkDto[];
}

export class BackfillPlanProgressDto {
  @ApiProperty()
  chunks!: number;

  @ApiProperty()
  instruments!: number;

  @ApiProperty()
  queued!: number;

  @ApiProperty()
  running!: number;

  @ApiProperty()
  succeeded!: number;

  @ApiProperty()
  partiallyFailed!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  cancelled!: number;

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
}

export class BackfillPlanDto extends JobRunDto {
  @ApiProperty({ type: BackfillPlanProgressDto })
  progress!: BackfillPlanProgressDto;
}

export class BackfillPlanChunkDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  instrumentId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  symbol!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  rank!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  chunkIndex!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  chunkCount!: number | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  requestedFrom!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  requestedTo!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  attempt!: number;

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

  @ApiProperty({ type: Number, nullable: true })
  httpStatus!: number | null;

  @ApiProperty({ type: String, nullable: true })
  providerErrorCode!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs!: number | null;

  @ApiProperty({ type: String, nullable: true })
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;
}

export class BackfillPlanDetailDto extends BackfillPlanDto {
  @ApiProperty({ type: [BackfillPlanChunkDto] })
  chunks!: BackfillPlanChunkDto[];
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

export class BackfillLaunchResponseDto {
  @ApiProperty({ type: JobRunDto, nullable: true })
  plan!: JobRunDto | null;

  @ApiProperty({ type: BackfillPreviewDto })
  preview!: BackfillPreviewDto;

  @ApiProperty({ type: [QueuedInstrumentDto] })
  queued!: QueuedInstrumentDto[];

  @ApiProperty({ type: [ExistingRunDto] })
  existingRunIds!: ExistingRunDto[];
}

export class FetchInstrumentsResponseDto {
  @ApiProperty({
    description: 'True when no queue work was created (preview response).',
  })
  dryRun!: boolean;

  @ApiProperty({ type: BackfillPreviewDto })
  preview!: BackfillPreviewDto;

  @ApiProperty({ type: JobRunDto, nullable: true, required: false })
  plan?: JobRunDto | null;

  @ApiProperty({ type: [QueuedInstrumentDto], required: false })
  queued?: QueuedInstrumentDto[];

  @ApiProperty({ type: [ExistingRunDto], required: false })
  existingRunIds?: ExistingRunDto[];
}

export class RetryFailedResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        instrumentId: { type: 'string', format: 'uuid' },
        jobRunId: { type: 'string', format: 'uuid' },
      },
      required: ['instrumentId', 'jobRunId'],
    },
  })
  queued!: { instrumentId: string; jobRunId: string }[];
}

export class RetryInstrumentResponseDto {
  @ApiProperty({
    type: JobRunDto,
    nullable: true,
    required: false,
    description: 'Active run returned instead of launching a duplicate.',
  })
  existing?: JobRunDto | null;

  @ApiProperty({ type: JobRunDto, nullable: true, required: false })
  plan?: JobRunDto | null;

  @ApiProperty({ type: BackfillPreviewDto, required: false })
  preview?: BackfillPreviewDto;

  @ApiProperty({ type: [QueuedInstrumentDto], required: false })
  queued?: QueuedInstrumentDto[];

  @ApiProperty({ type: [ExistingRunDto], required: false })
  existingRunIds?: ExistingRunDto[];
}

export class CancelInstrumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  planId!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'cancelled' })
  status!: string;
}

export class CorporateActionImportResultRowDto {
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

  @ApiProperty({ type: [CorporateActionImportResultRowDto] })
  results!: CorporateActionImportResultRowDto[];

  @ApiProperty()
  imported!: number;

  @ApiProperty()
  updated!: number;
}
