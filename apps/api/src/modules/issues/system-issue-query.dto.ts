import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { CursorQueryDto } from '../../common/pagination/pagination.dto.js';

export class SystemIssueQueryDto extends CursorQueryDto {
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
}
