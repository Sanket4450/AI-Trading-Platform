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
  RecomputeInstrumentCoverageDto,
} from './dto/instrument-coverage-query.dto.js';
import {
  CancelInstrumentFetchDto,
  CoverageDayDetailDto,
  InstrumentCoverageDetailDto,
  InstrumentCoverageRowDto,
  InstrumentCoverageSummaryDto,
  InstrumentFetchResponseDto,
} from './dto/instrument-coverage.dto.js';
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
  @ApiOkResponse({ type: InstrumentCoverageRowDto, isArray: true })
  list(@Query() query: InstrumentCoverageQueryDto) {
    return this.coverage.list(query);
  }

  @Get('status/summary')
  @ApiOperation({ summary: 'Summarise catalog fetch and coverage status for sync targets' })
  @ApiOkResponse({ type: InstrumentCoverageSummaryDto })
  summary() {
    return this.coverage.summary();
  }

  @Get(':instrumentId/coverage')
  @ApiOperation({ summary: 'Return coverage counters, month grid, runs and issues for one instrument' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiOkResponse({ type: InstrumentCoverageDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Instrument not found' })
  detail(@Param('instrumentId', ParseUUIDPipe) instrumentId: string) {
    return this.coverage.detail(instrumentId);
  }

  @Get(':instrumentId/coverage/:date')
  @ApiOperation({ summary: 'Return coverage, validation and issues for one instrument/day' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiParam({ name: 'date', format: 'date' })
  @ApiOkResponse({ type: CoverageDayDetailDto })
  coverageDay(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @Param('date') date: string,
  ) {
    return this.coverage.coverageDay(instrumentId, date);
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
  @ApiOperation({ summary: 'Cancel the active backfill run for one instrument' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiCreatedResponse({ type: CancelInstrumentFetchDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'No active backfill run for this instrument',
  })
  cancel(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ingestion.cancel(instrumentId, user.id, requestMeta(request));
  }
}
