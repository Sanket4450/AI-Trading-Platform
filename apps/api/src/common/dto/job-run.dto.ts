import { ApiProperty } from '@nestjs/swagger';

export class JobEventDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ example: 'chunks' })
  stage!: string;

  @ApiProperty({
    enum: ['entered', 'progress', 'completed', 'failed', 'skipped', 'warning'],
  })
  type!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  data!: Record<string, unknown>;
}

export class JobProgressDto {
  @ApiProperty({ example: 'chunks' })
  stage!: string;

  @ApiProperty({ example: 2 })
  stageIndex!: number;

  @ApiProperty({ example: 3 })
  stageTotal!: number;

  @ApiProperty({ type: Number, nullable: true })
  completed!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  total!: number | null;
}

export class JobRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'historical-backfill' })
  jobName!: string;

  @ApiProperty({ example: 'historical-data' })
  queueName!: string;

  @ApiProperty({ enum: ['ingestion', 'maintenance'] })
  jobType!: string;

  @ApiProperty({
    enum: ['queued', 'running', 'succeeded', 'failed', 'partially_failed', 'cancelled'],
  })
  status!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  groupId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  instrumentId!: string | null;

  @ApiProperty({ example: 0 })
  attempt!: number;

  @ApiProperty({ example: 3 })
  maxAttempts!: number;

  @ApiProperty({ type: Object, additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty({ type: Object, additionalProperties: true, nullable: true })
  result!: Record<string, unknown> | null;

  @ApiProperty({
    type: Object,
    additionalProperties: true,
    nullable: true,
    description: 'Structured failure: code, message, retryable, details.',
  })
  error!: Record<string, unknown> | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs!: number | null;

  @ApiProperty({ type: JobEventDto, nullable: true })
  latestEvent!: JobEventDto | null;

  @ApiProperty({ type: JobProgressDto, nullable: true })
  progress!: JobProgressDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: string | null;
}
