import { ApiProperty } from '@nestjs/swagger';

/** One active problem. Scope is derived from the two nullable foreign keys. */
export class SystemIssueDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ingestion' })
  source!: string;

  @ApiProperty({ example: 'candle_fetch_failed' })
  kind!: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  severity!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  providerId!: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  providerCode!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  instrumentId!: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  symbol!: string | null;

  @ApiProperty({ enum: ['instrument', 'provider', 'system'] })
  scope!: 'instrument' | 'provider' | 'system';

  @ApiProperty()
  dedupeKey!: string;

  @ApiProperty()
  occurrenceCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  firstSeenAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lastSeenAt!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  payload!: Record<string, unknown>;
}
