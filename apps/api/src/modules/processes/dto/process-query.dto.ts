import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const PROCESS_STATUSES = [
  'queued',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'partially_failed',
  'cancelled',
] as const;

export class ProcessQueryDto {
  @IsOptional()
  @IsIn(PROCESS_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  jobType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
