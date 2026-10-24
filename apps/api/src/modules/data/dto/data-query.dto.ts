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

export class CoverageQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @IsOptional()
  @IsIn(['complete', 'partial', 'missing'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;
}

export class IngestionRunsQueryDto {
  @IsOptional()
  @IsIn(['queued', 'running', 'succeeded', 'partially_failed', 'failed'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class QualityIssuesQueryDto {
  @IsOptional()
  @IsIn(['open', 'acknowledged', 'resolved', 'ignored'])
  status?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: string;

  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AcknowledgeIssueDto {
  @IsIn(['acknowledged', 'resolved', 'ignored'])
  status!: 'acknowledged' | 'resolved' | 'ignored';
}

export class BackfillDto {
  @IsUUID()
  instrumentId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class DailyStatsQueryDto {
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
