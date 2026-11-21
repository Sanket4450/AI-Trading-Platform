import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OffsetQueryDto } from '../../../common/pagination/pagination.dto.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const FETCH_STATUSES = [
  'not_requested',
  'queued',
  'fetching',
  'fetched',
  'partial',
  'failed',
  'cancelled',
  'stale',
] as const;

export const DATA_STATUSES = [
  'complete',
  'partial_mismatch',
  'missing',
  'pending',
  'not_applicable',
  'needs_review',
] as const;

export const CORPORATE_ACTION_TYPES = [
  'split',
  'bonus',
  'dividend',
  'merger',
  'demerger',
  'rights',
  'symbol_change',
] as const;

export class InstrumentCoverageQueryDto extends OffsetQueryDto {
  @ApiPropertyOptional({ enum: [...FETCH_STATUSES] })
  @IsOptional()
  @IsIn(FETCH_STATUSES)
  fetchStatus?: string;

  @ApiPropertyOptional({ enum: [...DATA_STATUSES] })
  @IsOptional()
  @IsIn(DATA_STATUSES)
  dataStatus?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class FetchInstrumentDto {
  @ApiPropertyOptional({
    enum: ['missing_only', 'force'],
    default: 'missing_only',
  })
  @IsOptional()
  @IsIn(['missing_only', 'force'])
  mode?: 'missing_only' | 'force';

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE)
  to?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Required when mode=force, recorded in the audit trail.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Preview only. Set false to enqueue the backfill.',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class RecomputeInstrumentCoverageDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE)
  to?: string;
}

export class CorporateActionRowDto {
  @ApiPropertyOptional({ maxLength: 12 })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @ApiPropertyOptional({ maxLength: 50, example: 'RELIANCE' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  symbol?: string;

  @ApiProperty({ format: 'date' })
  @Matches(DATE)
  exDate!: string;

  @ApiProperty({ enum: [...CORPORATE_ACTION_TYPES] })
  @IsIn(CORPORATE_ACTION_TYPES)
  actionType!: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  ratioNumerator?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  ratioDenominator?: string;

  @ApiPropertyOptional({ example: '10.50' })
  @IsOptional()
  @IsString()
  dividendPerShare?: string;

  @ApiPropertyOptional({ example: '0.5' })
  @IsOptional()
  @IsString()
  priceFactor?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  volumeFactor?: string;

  @ApiPropertyOptional({ maxLength: 40, example: 'reviewed-csv' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ enum: ['announced', 'confirmed'] })
  @IsOptional()
  @IsIn(['announced', 'confirmed'])
  status?: 'announced' | 'confirmed';
}

export class CorporateActionImportDto {
  @ApiPropertyOptional({ type: [CorporateActionRowDto], maxItems: 5000 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CorporateActionRowDto)
  rows?: CorporateActionRowDto[];

  @ApiPropertyOptional({
    maxLength: 2_000_000,
    description:
      'CSV with headers isin,symbol,ex_date,action_type,...; used when rows is empty.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  csv?: string;

  @ApiPropertyOptional({ maxLength: 40, default: 'reviewed-csv' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
