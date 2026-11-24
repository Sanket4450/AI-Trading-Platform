import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination/pagination.dto.js';

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

export class StrategyRuntimeDto {
  @ApiProperty({ enum: ['registered', 'unregistered', 'invalid_code_ref', 'implementation_missing', 'schema_mismatch'] })
  status!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ type: String, nullable: true })
  codeRef!: string | null;

  @ApiProperty({ type: String, nullable: true })
  implementation!: string | null;

  @ApiProperty({ type: String, nullable: true })
  implementationVersion!: string | null;

  @ApiProperty({ type: Boolean, nullable: true })
  schemaMatches!: boolean | null;

  @ApiProperty({ type: [String] })
  parameterNames!: string[];

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;
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

  @ApiProperty({
    enum: ['registered', 'unregistered', 'invalid_code_ref', 'implementation_missing', 'schema_mismatch'],
    required: false,
  })
  runtimeStatus?: string;

  @ApiProperty({ type: String, nullable: true, required: false })
  runtimeError?: string | null;

  @ApiProperty({ type: [StrategyBindingDto], required: false })
  bindings?: StrategyBindingDto[];

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
  activeActivations?: number;

  @ApiProperty({
    enum: ['registered', 'unregistered', 'invalid_code_ref', 'implementation_missing', 'schema_mismatch'],
    required: false,
  })
  runtimeStatus?: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false })
  lastEvaluationId?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  lastEvaluationStatus?: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, required: false })
  lastEvaluationAt?: string | null;
}

export class StrategyDetailDto extends StrategyDto {
  @ApiProperty({ type: [StrategyVersionDto] })
  versions!: StrategyVersionDto[];

  @ApiProperty({ type: StrategyRuntimeDto })
  runtime!: StrategyRuntimeDto;
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

export class StrategyListResponseDto {
  @ApiProperty({ type: [StrategyDto] })
  items!: StrategyDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class StrategySummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  versions!: number;

  @ApiProperty()
  activeActivations!: number;
}
