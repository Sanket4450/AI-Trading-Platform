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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { DataService } from './data.service.js';
import {
  AcknowledgeIssueDto,
  BackfillDto,
  CoverageQueryDto,
  DailyStatsQueryDto,
  IngestionRunsQueryDto,
  QualityIssuesQueryDto,
} from './dto/data-query.dto.js';

@ApiTags('data')
@ApiBearerAuth()
@Controller('data')
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get('coverage')
  coverage(@Query() query: CoverageQueryDto) {
    return this.data.coverage(query);
  }

  @Get('coverage/summary')
  coverageSummary(@Query('date') date?: string) {
    return this.data.coverageSummary(date);
  }

  @Get('ingestion-runs')
  ingestionRuns(@Query() query: IngestionRunsQueryDto) {
    return this.data.ingestionRuns(query);
  }

  @Get('quality-issues')
  qualityIssues(@Query() query: QualityIssuesQueryDto) {
    return this.data.qualityIssues(query);
  }

  @Get('daily-stats')
  dailyStats(@Query() query: DailyStatsQueryDto) {
    return this.data.dailyStats(query);
  }

  @Post('quality-issues/:id/acknowledge')
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AcknowledgeIssueDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.data.acknowledgeIssue(id, body, user.id, requestMeta(request));
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
