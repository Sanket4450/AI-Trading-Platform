import { ApiProperty } from '@nestjs/swagger';

export class ProviderBudgetDto {
  @ApiProperty()
  availableSecond!: number;

  @ApiProperty()
  availableMinute!: number;

  @ApiProperty()
  available30Minutes!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pausedUntil!: string | null;
}

export class ProviderStatusDto {
  @ApiProperty({ example: 'upstox' })
  provider!: string;

  @ApiProperty()
  networkEnabled!: boolean;

  @ApiProperty()
  apiKeyConfigured!: boolean;

  @ApiProperty()
  tokenConfigured!: boolean;

  @ApiProperty()
  baseUrl!: string;

  @ApiProperty()
  dailyOracleEnabled!: boolean;

  @ApiProperty({ type: ProviderBudgetDto, nullable: true })
  budget!: ProviderBudgetDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulSyncAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulBackfillAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulIntradayAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulValidationAt!: string | null;

  @ApiProperty()
  failedRuns24h!: number;

  @ApiProperty()
  runningChunks!: number;

  @ApiProperty()
  queuedChunks!: number;

  @ApiProperty()
  payloadCount!: number;

  @ApiProperty({ example: '12345678', oneOf: [{ type: 'string' }, { type: 'number' }] })
  payloadBytes!: string | number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  oldestPayloadAt!: string | null;
}
