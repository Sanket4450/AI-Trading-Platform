import { ApiProperty } from '@nestjs/swagger';

export class UniverseMemberDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  universeVersionId!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  isin!: string | null;

  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ type: String, nullable: true })
  medianTradedValue!: string | null;

  @ApiProperty({ type: String, format: 'date' })
  addedAt!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  removedAt!: string | null;
}

export class UniverseVersionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  universeId!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ type: String, format: 'date' })
  effectiveFrom!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  effectiveTo!: string | null;

  @ApiProperty({ example: 50 })
  memberCount!: number;

  @ApiProperty({ type: Object, additionalProperties: true })
  criteria!: Record<string, unknown>;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
  })
  sourceProviderId?: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
  })
  createdBy?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [UniverseMemberDto], required: false })
  members?: UniverseMemberDto[];
}

export class UniverseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'nifty-50' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'liquidity_rank' })
  selectionMethod!: string;

  @ApiProperty({ type: Number, nullable: true })
  lookbackSessions!: number | null;

  @ApiProperty({ example: 'quarterly' })
  refreshCadence!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  latestVersion!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  latestMemberCount!: number | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  latestEffectiveFrom!: string | null;

  @ApiProperty()
  versionCount!: number;
}

export class UniverseDetailDto extends UniverseDto {
  @ApiProperty({ type: [UniverseVersionDto] })
  versions!: UniverseVersionDto[];
}
