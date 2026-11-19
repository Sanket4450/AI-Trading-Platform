import { ApiProperty } from '@nestjs/swagger';
import { JobEventDto, JobProgressDto, JobRunDto } from '../../../common/dto/job-run.dto.js';

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

  @ApiProperty()
  quantified!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  completed!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  total!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  enteredAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs!: number | null;
}

export class JobDetailResponseDto {
  @ApiProperty({ type: JobRunDto })
  run!: JobRunDto;

  @ApiProperty({ type: [JobStageDto] })
  stages!: JobStageDto[];

  @ApiProperty({ type: [JobEventDto] })
  events!: JobEventDto[];

  @ApiProperty({ type: JobProgressDto, nullable: true })
  progress!: JobProgressDto | null;
}
