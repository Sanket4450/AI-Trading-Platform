import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CoverageQueryDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-01-15' })
  @IsOptional()
  @Matches(DATE)
  date?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({
    enum: ['complete', 'partial', 'missing', 'not_applicable'],
  })
  @IsOptional()
  @IsIn(['complete', 'partial', 'missing', 'not_applicable'])
  status?: string;

  @ApiPropertyOptional({
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
  @IsOptional()
  @IsIn([
    'not_checked',
    'pending',
    'matched',
    'volume_reconciled',
    'volume_mismatch',
    'ohlc_mismatch',
    'daily_missing',
    'minute_missing',
    'error',
  ])
  validationStatus?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 2000, default: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;
}

export class IngestionRunsQueryDto {
  @ApiPropertyOptional({
    enum: [
      'queued',
      'running',
      'succeeded',
      'partially_failed',
      'failed',
      'cancelled',
    ],
  })
  @IsOptional()
  @IsIn([
    'queued',
    'running',
    'succeeded',
    'partially_failed',
    'failed',
    'cancelled',
  ])
  status?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class QualityIssuesQueryDto {
  @ApiPropertyOptional({
    enum: ['open', 'acknowledged', 'resolved', 'ignored'],
  })
  @IsOptional()
  @IsIn(['open', 'acknowledged', 'resolved', 'ignored'])
  status?: string;

  @ApiPropertyOptional({ enum: ['info', 'warning', 'critical'] })
  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AcknowledgeIssueDto {
  @ApiProperty({ enum: ['acknowledged', 'resolved', 'ignored'] })
  @IsIn(['acknowledged', 'resolved', 'ignored'])
  status!: 'acknowledged' | 'resolved' | 'ignored';
}

export class BackfillDto {  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  instrumentId!: string;

  @ApiProperty({ format: 'date' })
  @Matches(DATE)
  from!: string;

  @ApiProperty({ format: 'date' })
  @Matches(DATE)
  to!: string;
}

export class DailyStatsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE)
  to?: string;
}
