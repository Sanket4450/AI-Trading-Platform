import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CursorQueryDto } from '../../../common/pagination/pagination.dto.js';

export class AuditQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'configuration_version' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({
    maxLength: 80,
    description: 'Case-insensitive substring match on the action name.',
    example: 'configuration.',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'Case-insensitive match across action, entity, actor, IP address and request ID.',
    example: 'configuration',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
