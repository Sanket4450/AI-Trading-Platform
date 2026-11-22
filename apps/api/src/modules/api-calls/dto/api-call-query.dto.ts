import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EXTERNAL_API_OUTCOMES, EXTERNAL_API_SERVICES } from '@ai-trading/domain';
import { toList } from '../../../common/query/list-param.js';
import { CursorQueryDto } from '../../../common/pagination/pagination.dto.js';

export class ApiCallQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only calls attached to this instrument.' })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @ApiPropertyOptional({
    enum: [...EXTERNAL_API_SERVICES],
    isArray: true,
    description: 'Repeat the parameter or comma-separate multiple services.',
  })
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @IsIn(EXTERNAL_API_SERVICES, { each: true })
  service?: string[];

  @ApiPropertyOptional({
    enum: [...EXTERNAL_API_OUTCOMES],
    isArray: true,
    description: 'Repeat the parameter or comma-separate multiple outcomes.',
  })
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @IsIn(EXTERNAL_API_OUTCOMES, { each: true })
  outcome?: string[];

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Case-insensitive match on operation, service, instrument symbol or job name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
