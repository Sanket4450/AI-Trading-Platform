import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const JOB_STATUSES = [
  'queued',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'cancelled',
] as const;

export class JobQueryDto {
  @ApiPropertyOptional({ enum: [...JOB_STATUSES] })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: string;

  @ApiPropertyOptional({ maxLength: 30, example: 'ingestion' })
  @IsOptional()
  @IsString()
  jobType?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
