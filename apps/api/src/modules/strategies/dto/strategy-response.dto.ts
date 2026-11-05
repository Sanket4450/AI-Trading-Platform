import { ApiProperty } from '@nestjs/swagger';

export class StrategyBindingDto {
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

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
  })
  boundBy?: string | null;

  @ApiProperty({ enum: ['strategy', 'risk', 'system'] })
  configType!: string;

  @ApiProperty({ example: 'orb' })
  scopeKey!: string;

  @ApiProperty({ example: 1 })
  configVersion!: number;

  @ApiProperty()
  payloadHash!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveFrom!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  effectiveTo!: string | null;
}

export class StrategyMemberDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  strategyVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ type: String, format: 'date' })
  effectiveFrom!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  effectiveTo!: string | null;

  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
  })
  universeVersionId?: string | null;
}

export class StrategyActivationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  strategyVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({ example: 'upstox-primary' })
  accountCode!: string;

  @ApiProperty({ enum: ['research', 'backtesting', 'paper', 'live'] })
  mode!: string;

  @ApiProperty({ enum: ['scheduled', 'active', 'paused', 'stopped'] })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  activatedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deactivatedAt!: string | null;
}

export class StrategyVersionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  strategyId!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty()
  codeRef!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  parameterSchema!: Record<string, unknown>;

  @ApiProperty({ enum: ['draft', 'validated', 'active', 'retired'] })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  changelog!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  releasedAt!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
  })
  createdBy?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [StrategyBindingDto], required: false })
  bindings?: StrategyBindingDto[];

  @ApiProperty({ type: [StrategyMemberDto], required: false })
  members?: StrategyMemberDto[];

  @ApiProperty({ type: [StrategyActivationDto], required: false })
  activations?: StrategyActivationDto[];
}

export class StrategyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'orb' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ['draft', 'research', 'active', 'retired'] })
  status!: string;

  @ApiProperty({ type: Number, nullable: true })
  latestVersion!: number | null;

  @ApiProperty({ type: String, nullable: true })
  latestVersionStatus!: string | null;

  @ApiProperty()
  versionCount!: number;

  @ApiProperty({ required: false })
  universeCount?: number;

  @ApiProperty({ required: false })
  activeActivations?: number;
}

export class StrategyDetailDto extends StrategyDto {
  @ApiProperty({ type: [StrategyVersionDto] })
  versions!: StrategyVersionDto[];
}

export class EffectiveConfigurationDto {
  @ApiProperty({ format: 'uuid' })
  configurationVersionId!: string;

  @ApiProperty({ enum: ['strategy', 'risk', 'system'] })
  configType!: string;

  @ApiProperty()
  scopeKey!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ type: Object, additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty()
  payloadHash!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveFrom!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  effectiveTo!: string | null;

  @ApiProperty({ enum: ['parameters', 'risk', 'execution'] })
  role!: string;
}
