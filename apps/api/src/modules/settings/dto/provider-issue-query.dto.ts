import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProviderIssueQueryDto {
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

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
