import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class SystemIssueQueryDto {
  @ApiPropertyOptional({ example: 'ingestion' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'candle_fetch_failed' })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiPropertyOptional({ enum: ['info', 'warning', 'critical'] })
  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: string;

  @ApiPropertyOptional({ enum: ['instrument', 'provider', 'system'] })
  @IsOptional()
  @IsIn(['instrument', 'provider', 'system'])
  scope?: 'instrument' | 'provider' | 'system';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
