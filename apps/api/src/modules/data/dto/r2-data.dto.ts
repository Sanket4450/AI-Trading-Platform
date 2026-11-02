import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class FetchInstrumentsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  instrumentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  universeCode?: string;

  @IsOptional()
  @IsIn(['missing_only', 'force'])
  mode?: 'missing_only' | 'force';

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class CreateBackfillPlanDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  instrumentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  universeCode?: string;

  @Matches(DATE)
  from!: string;

  @Matches(DATE)
  to!: string;

  @IsIn(['missing_only', 'force'])
  mode!: 'missing_only' | 'force';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class InstrumentStatusQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  universeCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  instrumentIds?: string[];

  @IsOptional()
  @IsIn([
    'not_requested',
    'queued',
    'fetching',
    'fetched',
    'partial',
    'failed',
    'cancelled',
    'stale',
  ])
  fetchStatus?: string;

  @IsOptional()
  @IsIn([
    'complete',
    'partial_reconciled',
    'partial_mismatch',
    'missing',
    'pending',
    'not_applicable',
    'needs_review',
  ])
  dataStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CoverageHeatmapQueryDto {
  @Matches(DATE)
  from!: string;

  @Matches(DATE)
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  universeCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

export class ValidationQueryDto {
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsIn([
    'matched',
    'volume_reconciled',
    'volume_mismatch',
    'ohlc_mismatch',
    'daily_missing',
    'minute_missing',
    'error',
  ])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;
}

export class QualityIssueActionDto {
  @IsIn(['acknowledged', 'resolved', 'ignored'])
  status!: 'acknowledged' | 'resolved' | 'ignored';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RecomputeStatusDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  instrumentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  universeCode?: string;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;
}

export class CorporateActionRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  symbol?: string;

  @Matches(DATE)
  exDate!: string;

  @IsIn([
    'split',
    'bonus',
    'dividend',
    'merger',
    'demerger',
    'rights',
    'symbol_change',
  ])
  actionType!: string;

  @IsOptional()
  @IsString()
  ratioNumerator?: string;

  @IsOptional()
  @IsString()
  ratioDenominator?: string;

  @IsOptional()
  @IsString()
  dividendPerShare?: string;

  @IsOptional()
  @IsString()
  priceFactor?: string;

  @IsOptional()
  @IsString()
  volumeFactor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsIn(['announced', 'confirmed'])
  status?: 'announced' | 'confirmed';
}

export class CorporateActionImportDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CorporateActionRowDto)
  rows?: CorporateActionRowDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  csv?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
