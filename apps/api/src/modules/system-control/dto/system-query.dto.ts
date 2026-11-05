import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'retrying',
  'cancelled',
] as const;

export class JobsQueryDto {
  @ApiPropertyOptional({ enum: [...JOB_STATUSES] })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class LimitQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class HealthSnapshotsQueryDto extends LimitQueryDto {
  @ApiPropertyOptional({
    enum: [
      'api',
      'web',
      'worker',
      'postgres',
      'redis',
      'upstox_api',
      'market_data_feed',
    ],
  })
  @IsOptional()
  @IsString()
  component?: string;
}

export class CalendarQueryDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 'NSE' })
  @IsOptional()
  @IsString()
  exchangeCode?: string;
}

export class AccountFeedQueryDto extends LimitQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
