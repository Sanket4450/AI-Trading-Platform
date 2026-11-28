import { ApiProperty } from '@nestjs/swagger';
import { JobRunDto } from '../../../common/dto/job-run.dto.js';
import { SystemIssueDto } from '../../../common/dto/system-issue.dto.js';

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
  openCriticalIssues!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  openWarningIssues!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  computedAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Queued or running historical-backfill job for this instrument, or null when nothing is in flight.',
  })
  activeJobId!: string | null;

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
  openCriticalIssues!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  openWarningIssues!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  computedAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Queued or running historical-backfill job for this instrument, or null when nothing is in flight.',
  })
  activeJobId!: string | null;

  @ApiProperty()
  mappingCount!: number;

  @ApiProperty({ type: [InstrumentCoverageMonthDto] })
  months!: InstrumentCoverageMonthDto[];
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

export class InstrumentCoverageDayRowDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ format: 'date' })
  tradingDate!: string;

  @ApiProperty({ example: 375 })
  expectedBars!: number;

  @ApiProperty({ example: 372 })
  storedBars!: number;

  @ApiProperty({ enum: ['complete', 'partial', 'missing'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  checkedAt!: string;
}

export class CoverageDayDetailDto {
  @ApiProperty({ type: CoverageInstrumentDto, nullable: true })
  instrument!: CoverageInstrumentDto | null;

  @ApiProperty({
    type: InstrumentCoverageDayRowDto,
    nullable: true,
    description:
      'Coverage row for the instrument/date pair. Null when the instrument was not expected to trade.',
  })
  coverage!: InstrumentCoverageDayRowDto | null;

  @ApiProperty({ type: [SystemIssueDto] })
  issues!: SystemIssueDto[];
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

export class ExistingJobDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ format: 'uuid' })
  jobRunId!: string;
}

export class InstrumentFetchResponseDto {
  @ApiProperty({
    description: 'True when no queue work was created (preview response).',
  })
  dryRun!: boolean;

  @ApiProperty({ type: InstrumentFetchPreviewDto })
  preview!: InstrumentFetchPreviewDto;

  @ApiProperty({ type: JobRunDto, nullable: true, required: false })
  job?: JobRunDto | null;

  @ApiProperty({ type: [QueuedInstrumentDto], required: false })
  queued?: QueuedInstrumentDto[];

  @ApiProperty({ type: [ExistingJobDto], required: false })
  existingJobIds?: ExistingJobDto[];
}

export class CancelInstrumentFetchDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Cancelled run, or null when nothing was in flight.',
  })
  jobRunId!: string | null;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({
    example: 'cancelled',
    description:
      '`cancelled` when a run was stopped, `not_running` when none existed.',
  })
  status!: string;

  @ApiProperty({
    example: 'cancelled',
    description:
      'Fetch status re-derived from the latest backfill run, so the row leaves a stalled queued/fetching state.',
  })
  fetchStatus!: string;
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
