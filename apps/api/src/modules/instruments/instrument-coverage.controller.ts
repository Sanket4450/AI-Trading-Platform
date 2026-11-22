import {
  Body,
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
import {
  InstrumentCoverageQueryDto,
  FetchInstrumentDto,
  InstrumentIssueQueryDto,
  RecomputeInstrumentCoverageDto,
} from './dto/instrument-coverage-query.dto.js';
import {
  CancelInstrumentFetchDto,
  CoverageDayDetailDto,
  InstrumentCoverageDetailDto,
  InstrumentCoverageSummaryDto,
  InstrumentFetchResponseDto,
} from './dto/instrument-coverage.dto.js';
import { OffsetQueryDto } from '../../common/pagination/pagination.dto.js';
import {
  InstrumentCoverageListResponseDto,
  InstrumentIssueListResponseDto,
} from './dto/instrument-list-response.dto.js';
import { InstrumentCoverageService } from './instrument-coverage.service.js';
import { InstrumentIngestionService } from './instrument-ingestion.service.js';

@ApiTags('instruments')
@ApiSessionAuth()
@Controller('instruments')
export class InstrumentCoverageController {
  constructor(
    private readonly coverage: InstrumentCoverageService,
    private readonly ingestion: InstrumentIngestionService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'List sync-target instruments with fetch and coverage status' })
  @ApiOkResponse({ type: InstrumentCoverageListResponseDto })
  list(@Query() query: InstrumentCoverageQueryDto) {
    return this.coverage.list(query);
  }

  @Get('status/summary')
  @ApiOperation({ summary: 'Summarise catalog fetch and coverage status for sync targets' })
  @ApiOkResponse({ type: InstrumentCoverageSummaryDto })
  summary(@Query() query: InstrumentCoverageQueryDto) {
    return this.coverage.summary(query);
  }

  @Get(':instrumentId/issues')
  @ApiOperation({
    summary: 'List active issues for one instrument',
    description: 'Newest-seen first, with cursor pagination (after/before).',
  })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiOkResponse({ type: InstrumentIssueListResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Instrument not found' })
  issues(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @Query() query: InstrumentIssueQueryDto,
  ) {
    return this.coverage.issues(instrumentId, query);
  }

  @Get(':instrumentId/coverage')
  @ApiOperation({ summary: 'Return coverage counters, month grid and issues for one instrument' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiOkResponse({ type: InstrumentCoverageDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Instrument not found' })
  detail(@Param('instrumentId', ParseUUIDPipe) instrumentId: string) {
    return this.coverage.detail(instrumentId);
  }

  @Get(':instrumentId/coverage/:date')
  @ApiOperation({ summary: 'Return coverage and issues for one instrument/day' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiParam({ name: 'date', format: 'date' })
  @ApiOkResponse({ type: CoverageDayDetailDto })
  coverageDay(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @Param('date') date: string,
  ) {
    return this.coverage.coverageDay(instrumentId, date);
  }

  @Get(':instrumentId/coverage/:date/issues')
  @ApiOperation({ summary: 'List active issues for one instrument/day' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiParam({ name: 'date', format: 'date' })
  @ApiOkResponse({ type: InstrumentIssueListResponseDto })
  dayIssues(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @Param('date') date: string,
    @Query() query: OffsetQueryDto,
  ) {
    return this.coverage.coverageDayIssues(instrumentId, date, query);
  }

  @Post(':instrumentId/coverage/recompute')
  @ApiOperation({ summary: 'Queue a coverage-status recomputation for one instrument' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiCreatedResponse({ type: JobRunDto })
  recompute(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @Body() body: RecomputeInstrumentCoverageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coverage.recompute(
      instrumentId,
      body,
      user.id,
      requestMeta(request),
    );
  }

  @Post(':instrumentId/fetch')
  @ApiOperation({
    summary: 'Preview or launch a historical fetch for one instrument',
    description:
      'dryRun defaults to true so the response is a plan preview. Set dryRun=false to enqueue work.',
  })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiCreatedResponse({ type: InstrumentFetchResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Instrument not found' })
  fetch(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @Body() body: FetchInstrumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ingestion.fetch(
      instrumentId,
      body,
      user.id,
      requestMeta(request),
    );
  }

  @Post(':instrumentId/fetch/cancel')
  @ApiOperation({
    summary: 'Cancel the active backfill run for one instrument',
    description:
      'Idempotent. When no backfill is in flight the projection is re-derived instead of failing, and the response reports status "not_running".',
  })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiCreatedResponse({ type: CancelInstrumentFetchDto })
  cancel(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ingestion.cancel(instrumentId, user.id, requestMeta(request));
  }
}
