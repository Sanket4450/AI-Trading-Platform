import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { configurationTypes } from './create-configuration.dto.js';

export class ListConfigurationDto {
  @IsOptional()
  @IsIn(configurationTypes)
  configType?: string;

  @IsOptional()
  @IsString()
  scopeKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
