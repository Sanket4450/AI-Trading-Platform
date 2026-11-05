import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const configurationTypes = ['strategy', 'risk', 'system'] as const;
export const bindingRoles = ['parameters', 'risk', 'execution'] as const;

export class CreateConfigurationDto {
  @ApiProperty({ enum: [...configurationTypes] })
  @IsIn(configurationTypes)
  configType!: (typeof configurationTypes)[number];

  @ApiProperty({
    description:
      'Strategy code for strategy configuration, otherwise a risk/system scope key.',
    minLength: 1,
    maxLength: 80,
    example: 'orb',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  scopeKey!: string;

  @ApiProperty({
    description: 'JSON payload validated against the scoped JSON schema.',
    type: Object,
    additionalProperties: true,
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({ example: '1.0', minLength: 1, maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  schemaVersion!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601()
  effectiveFrom!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Previous configuration version this version replaces.',
  })
  @IsOptional()
  @IsUUID()
  supersedesId?: string;
}

export class BindConfigurationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  strategyVersionId!: string;

  @ApiProperty({ enum: [...bindingRoles] })
  @IsIn(bindingRoles)
  role!: (typeof bindingRoles)[number];
}
