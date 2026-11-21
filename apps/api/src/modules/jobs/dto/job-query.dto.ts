import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CursorQueryDto } from '../../../common/pagination/pagination.dto.js';

export const JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'partially_failed',
  'cancelled',
] as const;

export class JobQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({
    enum: [...JOB_STATUSES],
    isArray: true,
    description: 'Repeat the parameter or comma-separate multiple statuses.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    return (Array.isArray(value) ? value : String(value).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsIn(JOB_STATUSES, { each: true })
  status?: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Only jobs for one instrument.' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Case-insensitive match on job name, status or run ID.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
