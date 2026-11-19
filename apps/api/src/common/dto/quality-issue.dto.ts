import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class QualityIssueDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, required: false })
  providerCode!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  instrumentId!: string | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  symbol!: string | null;

  @ApiProperty({ example: 'volume_mismatch' })
  issueType!: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  severity!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  tradingDate!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  windowStart!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  windowEnd!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({ enum: ['open', 'acknowledged', 'resolved', 'ignored'] })
  status!: string;

  @ApiProperty({ example: 'validation' })
  detectedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  detectedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ruleId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  dedupeKey!: string | null;

  @ApiProperty()
  occurrenceCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  lastSeenAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  acknowledgedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acknowledgedAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resolutionNote!: string | null;
}

export class QualityIssueActionDto {
  @ApiProperty({
    enum: ['acknowledged', 'resolved', 'ignored'],
    example: 'acknowledged',
  })
  @IsIn(['acknowledged', 'resolved', 'ignored'])
  status!: 'acknowledged' | 'resolved' | 'ignored';

  @ApiPropertyOptional({
    description: 'Required when resolving or ignoring an issue.',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
