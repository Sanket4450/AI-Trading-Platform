import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { OffsetQueryDto } from '../../../common/pagination/pagination.dto.js';
import {
  EVALUATION_REASON_CODES,
  EVALUATION_RESULT_STATUSES,
  EVALUATION_RUN_STATUSES,
  RESEARCH_SIGNAL_TYPES,
} from '@ai-trading/domain';

export class EvaluationRunQueryDto extends OffsetQueryDto {
  @ApiPropertyOptional({ enum: [...EVALUATION_RUN_STATUSES] })
  @IsOptional()
  @IsIn(EVALUATION_RUN_STATUSES)
  status?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'Runs overlapping this date or later.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date', description: 'Runs ending on or before this date.' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class EvaluationResultQueryDto extends OffsetQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: [...EVALUATION_RESULT_STATUSES] })
  @IsOptional()
  @IsIn(EVALUATION_RESULT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: [...EVALUATION_REASON_CODES] })
  @IsOptional()
  @IsIn(EVALUATION_REASON_CODES)
  reasonCode?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;
}

export class SignalQueryDto extends OffsetQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Restrict to one evaluation run.' })
  @IsOptional()
  @IsUUID()
  runId?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({ enum: [...RESEARCH_SIGNAL_TYPES] })
  @IsOptional()
  @IsIn(RESEARCH_SIGNAL_TYPES)
  signalType?: string;
}

export class RunSignalQueryDto extends OffsetQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({ enum: [...RESEARCH_SIGNAL_TYPES] })
  @IsOptional()
  @IsIn(RESEARCH_SIGNAL_TYPES)
  signalType?: string;
}
