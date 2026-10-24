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
  @IsIn(configurationTypes)
  configType!: (typeof configurationTypes)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  scopeKey!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  schemaVersion!: string;

  @IsISO8601()
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @IsOptional()
  @IsUUID()
  supersedesId?: string;
}

export class BindConfigurationDto {
  @IsUUID()
  strategyVersionId!: string;

  @IsIn(bindingRoles)
  role!: (typeof bindingRoles)[number];
}
