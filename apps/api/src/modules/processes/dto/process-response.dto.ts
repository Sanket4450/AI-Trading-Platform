import { ApiProperty } from '@nestjs/swagger';
import { JobRunDto } from '../../../common/dto/job-run.dto.js';

export class ProcessSummaryDto {
  @ApiProperty()
  running!: number;

  @ApiProperty()
  failed24h!: number;

  @ApiProperty()
  succeeded24h!: number;

  @ApiProperty()
  p95DurationMs!: number;
}

export class ProcessRunDto extends JobRunDto {}

export class ProcessListResponseDto {
  @ApiProperty({ type: ProcessSummaryDto })
  summary!: ProcessSummaryDto;

  @ApiProperty({ type: [ProcessRunDto] })
  items!: ProcessRunDto[];
}

export class ProcessStageDto {
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

export class ProcessMetricDto {
  @ApiProperty()
  key!: string;

  @ApiProperty({ type: Number, nullable: true })
  value!: number | null;

  @ApiProperty({ type: String, nullable: true })
  unit!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  at!: string;
}

export class ProcessEventDto {
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

export class ProcessDetailDto {
  @ApiProperty({ type: ProcessRunDto })
  run!: ProcessRunDto;

  @ApiProperty({ type: [ProcessStageDto] })
  stages!: ProcessStageDto[];

  @ApiProperty({ type: [ProcessMetricDto] })
  metrics!: ProcessMetricDto[];

  @ApiProperty({ type: [ProcessEventDto] })
  events!: ProcessEventDto[];
}
