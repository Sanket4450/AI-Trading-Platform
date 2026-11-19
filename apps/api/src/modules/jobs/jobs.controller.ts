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
import { requestMeta } from '../../common/http/request-meta.js';
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

  @Get(':id')
  @ApiOperation({ summary: 'Return a job run with its stage rail and events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: JobDetailResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Job not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.detail(id);
  }
}
