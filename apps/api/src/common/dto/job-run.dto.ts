import { ApiProperty } from '@nestjs/swagger';

export class JobRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'historical-backfill' })
  jobName!: string;

  @ApiProperty({ example: 'historical-data' })
  queueName!: string;

  @ApiProperty({
    enum: [
      'ingestion',
      'backtest',
      'analytics',
      'reconciliation',
      'square_off',
      'report',
      'maintenance',
      'credential_refresh',
    ],
  })
  jobType!: string;

  @ApiProperty({
    enum: [
      'queued',
      'running',
      'succeeded',
      'failed',
      'retrying',
      'cancelled',
    ],
  })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  scheduledFor!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ example: 0 })
  attempt!: number;

  @ApiProperty({ example: 3 })
  maxAttempts!: number;

  @ApiProperty({ type: Object, additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty({
    type: Object,
    additionalProperties: true,
    nullable: true,
  })
  result!: Record<string, unknown> | null;

  @ApiProperty({ type: String, nullable: true })
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  correlationId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  currentStage!: string | null;

  @ApiProperty({ type: [String] })
  stageKeys!: string[];

  @ApiProperty({ type: Number, nullable: true })
  stageTotal!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs!: number | null;

  @ApiProperty({ type: String, nullable: true })
  summary!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
