import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination/pagination.dto.js';
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
  @ApiProperty({ type: [JobRunDto] })
  items!: JobRunDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class JobEventListResponseDto {
  @ApiProperty({ type: [JobEventDto] })
  items!: JobEventDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
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

  @ApiProperty({ type: [JobEventDto], description: 'Newest page, chronological order.' })
  events!: JobEventDto[];

  @ApiProperty({ type: PaginationMetaDto })
  eventsPage!: PaginationMetaDto;

  @ApiProperty({ type: JobProgressDto, nullable: true })
  progress!: JobProgressDto | null;
}
