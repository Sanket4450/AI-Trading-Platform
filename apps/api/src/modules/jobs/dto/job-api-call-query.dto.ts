import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';
import { EXTERNAL_API_OUTCOMES, EXTERNAL_API_SERVICES } from '@ai-trading/domain';
import { toList } from '../../../common/query/list-param.js';
import { CursorQueryDto } from '../../../common/pagination/pagination.dto.js';

export class JobApiCallQueryDto extends CursorQueryDto {
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
    enum: [...EXTERNAL_API_SERVICES],
    isArray: true,
    description: 'Repeat the parameter or comma-separate multiple services.',
  })
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @IsIn(EXTERNAL_API_SERVICES, { each: true })
  service?: string[];
}
