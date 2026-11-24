import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination/pagination.dto.js';
import { StrategyRuntimeDto } from './strategy-response.dto.js';

export class EvaluationRunSummaryDto {
  @ApiProperty()
  instrumentDays!: number;

  @ApiProperty()
  instrumentsWithSignals!: number;

  @ApiProperty()
  entries!: number;

  @ApiProperty()
  exits!: number;

  @ApiProperty()
  skippedDays!: number;

  @ApiProperty()
  noSignalDays!: number;
}

export class EvaluationRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  strategyVersionId!: string;

  @ApiProperty({ example: 2 })
  version!: number;

  @ApiProperty({ example: 'opening-range-breakout@1.0.0' })
  codeRef!: string;

  @ApiProperty({ format: 'uuid' })
  configurationVersionId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  riskConfigurationVersionId!: string | null;

  @ApiProperty({ example: '2026-09-01' })
  fromDate!: string;

  @ApiProperty({ example: '2026-09-30' })
  toDate!: string;

  @ApiProperty({ example: '1000000.00' })
  initialCapital!: string;

  @ApiProperty({ enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  jobRunId!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true, nullable: true })
  error!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ required: false })
  entries?: number;

  @ApiProperty({ required: false })
  exits?: number;

  @ApiProperty({ required: false })
  instrumentDays?: number;
}

export class EvaluationRunDetailDto extends EvaluationRunDto {
  @ApiProperty({ format: 'uuid' })
  strategyId!: string;

  @ApiProperty({ example: 'orb-15m' })
  strategyCode!: string;

  @ApiProperty()
  strategyName!: string;

  @ApiProperty({ example: 1 })
  parameterVersion!: number;

  @ApiProperty()
  parameterHash!: string;

  @ApiProperty({ type: Number, nullable: true })
  riskVersion!: number | null;

  @ApiProperty({ type: StrategyRuntimeDto })
  runtime!: StrategyRuntimeDto;

  @ApiProperty({ type: EvaluationRunSummaryDto })
  summary!: EvaluationRunSummaryDto;
}

export class EvaluationRunListResponseDto {
  @ApiProperty({ type: [EvaluationRunDto] })
  items!: EvaluationRunDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class EvaluationResultDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['signal', 'no_signal', 'skipped'] })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  reasonCode!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  diagnostics!: Record<string, unknown>;

  @ApiProperty()
  signalCount!: number;
}

export class EvaluationResultListResponseDto {
  @ApiProperty({ type: [EvaluationResultDto] })
  items!: EvaluationResultDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class ResearchSignalDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  evaluationRunId!: string | null;

  @ApiProperty({ format: 'uuid' })
  strategyVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  signalAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  candleStart!: string;

  @ApiProperty({ enum: ['long'] })
  direction!: string;

  @ApiProperty({ enum: ['entry', 'stop', 'target', 'eod'] })
  signalType!: string;

  @ApiProperty({ example: '101.0500' })
  referencePrice!: string;

  @ApiProperty({ type: String, nullable: true })
  entryPrice!: string | null;

  @ApiProperty({ type: String, nullable: true })
  stopPrice!: string | null;

  @ApiProperty({ type: String, nullable: true })
  targetPrice!: string | null;

  @ApiProperty({ type: String, nullable: true })
  quantity!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  evidence!: Record<string, unknown>;

  @ApiProperty({ example: 'created' })
  status!: string;
}

export class ResearchSignalDetailDto extends ResearchSignalDto {
  @ApiProperty({ example: 2 })
  version!: number;

  declare evidence: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ResearchSignalListResponseDto {
  @ApiProperty({ type: [ResearchSignalDto] })
  items!: ResearchSignalDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}
