import { ApiProperty } from '@nestjs/swagger';
import { JobRunDto } from '../../../common/dto/job-run.dto.js';

export class JobSummaryDto {
  @ApiProperty()
  running!: number;

  @ApiProperty()
  failed24h!: number;

  @ApiProperty()
  succeeded24h!: number;

  @ApiProperty()
  p95DurationMs!: number;
}

export class JobListResponseDto {
  @ApiProperty({ type: JobSummaryDto })
  summary!: JobSummaryDto;

  @ApiProperty({ type: [JobRunDto] })
  items!: JobRunDto[];
}

export class JobStageDto {
  @ApiProperty()
  key!: string;

  @ApiProperty({
    enum: ['pending', 'running', 'succeeded', 'failed', 'skipped'],
  })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  enteredAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs!: number | null;
}

export class JobMetricDto {
  @ApiProperty()
  key!: string;

  @ApiProperty({ type: Number, nullable: true })
  value!: number | null;

  @ApiProperty({ type: String, nullable: true })
  unit!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  at!: string;
}

export class JobEventDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({
    enum: ['lifecycle', 'stage', 'step', 'metric', 'warning', 'error'],
  })
  kind!: string;

  @ApiProperty({ enum: ['debug', 'info', 'warn', 'error'] })
  level!: string;

  @ApiProperty({ type: String, nullable: true })
  stageKey!: string | null;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  data!: Record<string, unknown>;

  @ApiProperty({ type: String, nullable: true })
  metricKey!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  metricValue!: number | null;

  @ApiProperty({ type: String, nullable: true })
  metricUnit!: string | null;
}

export class JobDetailResponseDto {
  @ApiProperty({ type: JobRunDto })
  run!: JobRunDto;

  @ApiProperty({ type: [JobStageDto] })
  stages!: JobStageDto[];

  @ApiProperty({ type: [JobMetricDto] })
  metrics!: JobMetricDto[];

  @ApiProperty({ type: [JobEventDto] })
  events!: JobEventDto[];
}
