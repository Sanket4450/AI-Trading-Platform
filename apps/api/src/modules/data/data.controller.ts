import {
  BadRequestException,
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
  ApiQuery,
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
import { CatalogService } from './catalog.service.js';
import { DataService } from './data.service.js';
import {
  BackfillDto,
  CoverageQueryDto,
  DailyStatsQueryDto,
  IngestionRunsQueryDto,
  QualityIssuesQueryDto,
} from './dto/data-query.dto.js';
import {
  CoverageDayDetailDto,
  CoverageHeatmapCellDto,
  CoverageRowDto,
  CoverageSummaryDto,
  DailyStatDto,
  DailyValidationDto,
  IngestionRunDetailDto,
  IngestionRunDto,
  ProviderStatusDto,
  QualityIssueDto,
  QualityRuleDto,
} from './dto/data-response.dto.js';
import {
  CoverageHeatmapQueryDto,
  QualityIssueActionDto,
  ValidationQueryDto,
} from './dto/r2-data.dto.js';

@ApiTags('data')
@ApiSessionAuth()
@Controller('data')
export class DataController {
  constructor(
    private readonly data: DataService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('coverage')
  @ApiOperation({ summary: 'List per-instrument, per-day coverage rows' })
  @ApiOkResponse({ type: CoverageRowDto, isArray: true })
  coverage(@Query() query: CoverageQueryDto) {
    return this.data.coverage(query);
  }

  @Get('coverage/summary')
  @ApiOperation({ summary: 'Summarise coverage status and validation counts' })
  @ApiQuery({ name: 'date', required: false, format: 'date' })
  @ApiOkResponse({ type: CoverageSummaryDto })
  coverageSummary(@Query('date') date?: string) {
    return this.data.coverageSummary(date);
  }

  @Get('coverage/heatmap')
  @ApiOperation({ summary: 'Return coverage heatmap cells for a universe and date range' })
  @ApiOkResponse({ type: CoverageHeatmapCellDto, isArray: true })
  coverageHeatmap(@Query() query: CoverageHeatmapQueryDto) {
    return this.catalog.coverageHeatmap(query);
  }

  @Get('coverage/:instrumentId/:date')
  @ApiOperation({ summary: 'Return coverage, validation and issues for one instrument/day' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiParam({ name: 'date', format: 'date' })
  @ApiOkResponse({ type: CoverageDayDetailDto })
  coverageDayDetail(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @Param('date') date: string,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    return this.catalog.coverageDayDetail(instrumentId, date);
  }

  @Get('ingestion-runs')
  @ApiOperation({ summary: 'List ingestion runs' })
  @ApiOkResponse({ type: IngestionRunDto, isArray: true })
  ingestionRuns(@Query() query: IngestionRunsQueryDto) {
    return this.data.ingestionRuns(query);
  }

  @Get('ingestion-runs/:id')
  @ApiOperation({ summary: 'Return an ingestion run with its archived raw payload metadata' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: IngestionRunDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Ingestion run not found' })
  ingestionRunDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.runDetail(id);
  }

  @Get('quality-issues')
  @ApiOperation({ summary: 'List data-quality issues' })
  @ApiOkResponse({ type: QualityIssueDto, isArray: true })
  qualityIssues(@Query() query: QualityIssuesQueryDto) {
    return this.data.qualityIssues(query);
  }

  @Get('quality-issues/:id')
  @ApiOperation({ summary: 'Return one data-quality issue' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: QualityIssueDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Quality issue not found' })
  qualityIssueDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.issueDetail(id);
  }

  @Post('quality-issues/:id/acknowledge')
  @ApiOperation({ summary: 'Transition a data-quality issue status' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: QualityIssueDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Quality issue not found' })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: QualityIssueActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.acknowledgeIssue(
      id,
      body,
      user.id,
      requestMeta(request),
    );
  }

  @Get('daily-stats')
  @ApiOperation({ summary: 'List materialized daily OHLCV statistics' })
  @ApiOkResponse({ type: DailyStatDto, isArray: true })
  dailyStats(@Query() query: DailyStatsQueryDto) {
    return this.data.dailyStats(query);
  }

  @Get('validation')
  @ApiOperation({ summary: 'List daily oracle validation results' })
  @ApiOkResponse({ type: DailyValidationDto, isArray: true })
  validation(@Query() query: ValidationQueryDto) {
    return this.catalog.validation(query);
  }

  @Get('provider-status')
  @ApiOperation({ summary: 'Return provider configuration, budget and ingestion health' })
  @ApiOkResponse({ type: ProviderStatusDto })
  providerStatus() {
    return this.catalog.providerStatus();
  }

  @Get('quality-rules')
  @ApiOperation({ summary: 'List the data-quality rule catalog' })
  @ApiOkResponse({ type: QualityRuleDto, isArray: true })
  qualityRules() {
    return this.catalog.qualityRules();
  }

  @Post('backfill')
  @ApiOperation({
    summary: 'Queue a bounded legacy single-instrument backfill',
    description:
      'Limited to the configured maximum window (31 days by default). Prefer the instrument catalog.',
  })
  @ApiCreatedResponse({ type: JobRunDto })
  backfill(
    @Body() body: BackfillDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.data.backfill(body, user.id, requestMeta(request));
  }

  @Post('refresh-materialized-view')
  @ApiOperation({ summary: 'Queue a materialized-view refresh' })
  @ApiCreatedResponse({ type: JobRunDto })
  refreshMaterializedView(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.data.refreshMaterializedView(user.id, requestMeta(request));
  }
}
