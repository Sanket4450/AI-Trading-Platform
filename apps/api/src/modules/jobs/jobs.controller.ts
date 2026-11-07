import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { JobDetailResponseDto, JobListResponseDto } from './dto/job-response.dto.js';
import { JobQueryDto } from './dto/job-query.dto.js';
import { JobsService } from './jobs.service.js';

@ApiTags('jobs')
@ApiSessionAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'List background job runs with a 24-hour summary' })
  @ApiOkResponse({ type: JobListResponseDto })
  list(@Query() query: JobQueryDto) {
    return this.jobs.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a job run with stages, metrics and events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: JobDetailResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Job not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.detail(id);
  }
}
