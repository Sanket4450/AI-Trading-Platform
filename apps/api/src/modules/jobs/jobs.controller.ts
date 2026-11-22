import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { JobRunDto } from '../../common/dto/job-run.dto.js';
import { CursorQueryDto } from '../../common/pagination/pagination.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import {
  JobDetailResponseDto,
  JobEventListResponseDto,
  JobListResponseDto,
  JobSummaryDto,
} from './dto/job-response.dto.js';
import { ExternalApiCallListResponseDto } from '../../common/dto/external-api-call.dto.js';
import { JobApiCallQueryDto } from './dto/job-api-call-query.dto.js';
import { JobQueryDto } from './dto/job-query.dto.js';
import { JobsService } from './jobs.service.js';

@ApiTags('jobs')
@ApiSessionAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'List background job runs, newest first' })
  @ApiOkResponse({ type: JobListResponseDto })
  list(@Query() query: JobQueryDto) {
    return this.jobs.list(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Return the 24-hour job summary' })
  @ApiOkResponse({ type: JobSummaryDto })
  summary() {
    return this.jobs.summary();
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel one job run' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: JobRunDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Job not found' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.jobs.cancel(id, user.id, requestMeta(request));
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List older events for one job run' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: JobEventListResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Job not found' })
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorQueryDto,
  ) {
    return this.jobs.listEvents(id, query);
  }

  @Get(':id/api-calls')
  @ApiOperation({ summary: 'List the outbound API calls of one job run, newest first' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ExternalApiCallListResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Job not found' })
  apiCalls(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: JobApiCallQueryDto,
  ) {
    return this.jobs.listApiCalls(id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a job run with its stage rail and events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: JobDetailResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Job not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.detail(id);
  }
}
