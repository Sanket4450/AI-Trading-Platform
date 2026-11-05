import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { configurationTypes } from './create-configuration.dto.js';

export class ListConfigurationDto {
  @ApiPropertyOptional({ enum: [...configurationTypes] })
  @IsOptional()
  @IsIn(configurationTypes)
  configType?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  scopeKey?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
