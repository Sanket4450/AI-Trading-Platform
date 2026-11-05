import { ApiProperty } from '@nestjs/swagger';

export class ConfigurationBindingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  strategyVersionId!: string;

  @ApiProperty({ enum: ['parameters', 'risk', 'execution'] })
  role!: string;

  @ApiProperty({ example: 'orb' })
  strategyCode!: string;

  @ApiProperty({ example: 1 })
  strategyVersion!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  boundAt!: string;
}

export class ConfigurationVersionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['strategy', 'risk', 'system'] })
  configType!: string;

  @ApiProperty({ example: 'orb' })
  scopeKey!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ type: Object, additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty()
  payloadHash!: string;

  @ApiProperty({ example: '1.0' })
  schemaVersion!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveFrom!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  effectiveTo!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  supersedesId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [ConfigurationBindingDto], required: false })
  bindings?: ConfigurationBindingDto[];
}

export class ConfigurationCreatedDto extends ConfigurationVersionDto {
  @ApiProperty({
    description: 'False when an identical payload hash already existed.',
  })
  created!: boolean;
}

export class ConfigurationDiffEntryDto {
  @ApiProperty()
  path!: string;

  @ApiProperty({ required: false })
  left?: unknown;

  @ApiProperty({ required: false })
  right?: unknown;
}

export class ConfigurationDiffSideDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['strategy', 'risk', 'system'] })
  configType!: string;

  @ApiProperty()
  scopeKey!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  payloadHash!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  payload!: Record<string, unknown>;
}

export class ConfigurationDiffDto {
  @ApiProperty({ type: ConfigurationDiffSideDto })
  left!: ConfigurationDiffSideDto;

  @ApiProperty({ type: ConfigurationDiffSideDto })
  right!: ConfigurationDiffSideDto;

  @ApiProperty({ type: [ConfigurationDiffEntryDto] })
  changes!: ConfigurationDiffEntryDto[];
}

export class StrategyConfigBindingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  strategyVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  configurationVersionId!: string;

  @ApiProperty({ enum: ['parameters', 'risk', 'execution'] })
  role!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  boundAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  boundBy!: string | null;
}
