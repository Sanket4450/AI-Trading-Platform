import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OffsetQueryDto } from '../../../common/pagination/pagination.dto.js';
import { configurationTypes } from './create-configuration.dto.js';

export class ListConfigurationDto extends OffsetQueryDto {
  @ApiPropertyOptional({ enum: [...configurationTypes] })
  @IsOptional()
  @IsIn(configurationTypes)
  configType?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  scopeKey?: string;
}
