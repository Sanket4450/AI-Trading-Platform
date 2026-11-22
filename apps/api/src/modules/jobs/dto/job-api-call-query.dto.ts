import { ApiPropertyOptional } from '@nestjs/swagger';
import { EXTERNAL_API_OUTCOMES, EXTERNAL_API_SERVICES } from '@ai-trading/domain';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CursorQueryDto } from '../../../common/pagination/pagination.dto.js';

export class JobApiCallQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: [...EXTERNAL_API_OUTCOMES] })
  @IsOptional()
  @IsIn(EXTERNAL_API_OUTCOMES)
  outcome?: string;

  @ApiPropertyOptional({ enum: [...EXTERNAL_API_SERVICES] })
  @IsOptional()
  @IsString()
  @IsIn(EXTERNAL_API_SERVICES)
  service?: string;
}
