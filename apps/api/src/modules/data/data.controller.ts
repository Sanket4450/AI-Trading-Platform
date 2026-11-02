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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { requestMeta } from '../../common/http/request-meta.js';
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
  CoverageHeatmapQueryDto,
  QualityIssueActionDto,
  ValidationQueryDto,
} from './dto/r2-data.dto.js';

@ApiTags('data')
@ApiBearerAuth()
@Controller('data')
export class DataController {
  constructor(
    private readonly data: DataService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('coverage')
  coverage(@Query() query: CoverageQueryDto) {
    return this.data.coverage(query);
  }

  @Get('coverage/summary')
  coverageSummary(@Query('date') date?: string) {
    return this.data.coverageSummary(date);
  }

  @Get('coverage/heatmap')
  coverageHeatmap(@Query() query: CoverageHeatmapQueryDto) {
    return this.catalog.coverageHeatmap(query);
  }

  @Get('coverage/:instrumentId/:date')
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
  ingestionRuns(@Query() query: IngestionRunsQueryDto) {
    return this.data.ingestionRuns(query);
  }

  @Get('ingestion-runs/:id')
  ingestionRunDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.runDetail(id);
  }

  @Get('quality-issues')
  qualityIssues(@Query() query: QualityIssuesQueryDto) {
    return this.data.qualityIssues(query);
  }

  @Get('quality-issues/:id')
  qualityIssueDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.issueDetail(id);
  }

  @Post('quality-issues/:id/acknowledge')
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
  dailyStats(@Query() query: DailyStatsQueryDto) {
    return this.data.dailyStats(query);
  }

  @Get('validation')
  validation(@Query() query: ValidationQueryDto) {
    return this.catalog.validation(query);
  }

  @Get('provider-status')
  providerStatus() {
    return this.catalog.providerStatus();
  }

  @Get('quality-rules')
  qualityRules() {
    return this.catalog.qualityRules();
  }

  @Post('backfill')
  backfill(
    @Body() body: BackfillDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.data.backfill(body, user.id, requestMeta(request));
  }

  @Post('refresh-materialized-view')
  refreshMaterializedView(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.data.refreshMaterializedView(user.id, requestMeta(request));
  }
}
