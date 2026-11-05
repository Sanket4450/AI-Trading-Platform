import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { JobRunDto } from '../../common/dto/job-run.dto.js';
import { TradingSessionDto } from '../accounts/dto/account-response.dto.js';
import {
  AccountFeedQueryDto,
  CalendarQueryDto,
  HealthSnapshotsQueryDto,
  JobsQueryDto,
  LimitQueryDto,
} from './dto/system-query.dto.js';
import {
  HealthSnapshotDto,
  NotificationEventDto,
  OverviewDto,
  ReportRunDto,
  RiskEventDto,
  SystemStatusDto,
  TradingCalendarDto,
} from './dto/system-response.dto.js';
import { SystemControlService } from './system-control.service.js';

function limit(value: number | undefined, fallback = 100): number {
  return Number.isFinite(value) && value! > 0
    ? Math.min(value!, 500)
    : fallback;
}

@ApiTags('system')
@ApiSessionAuth()
@Controller('system')
export class SystemControlController {
  constructor(private readonly system: SystemControlService) {}

  @Get('status')
  @ApiOperation({ summary: 'Return mode, counts, health and queue depth' })
  @ApiOkResponse({ type: SystemStatusDto })
  status() {
    return this.system.status();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Return the dashboard overview' })
  @ApiOkResponse({ type: OverviewDto })
  overview() {
    return this.system.overview();
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List background job runs' })
  @ApiOkResponse({ type: JobRunDto, isArray: true })
  jobs(@Query() query: JobsQueryDto) {
    return this.system.jobs(limit(query.limit), query.status);
  }

  @Get('health-snapshots')
  @ApiOperation({ summary: 'List recorded health snapshots' })
  @ApiOkResponse({ type: HealthSnapshotDto, isArray: true })
  healthSnapshots(@Query() query: HealthSnapshotsQueryDto) {
    return this.system.healthSnapshots(limit(query.limit), query.component);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List notification events' })
  @ApiOkResponse({ type: NotificationEventDto, isArray: true })
  notifications(@Query() query: LimitQueryDto) {
    return this.system.notifications(limit(query.limit));
  }

  @Get('reports')
  @ApiOperation({ summary: 'List report runs' })
  @ApiOkResponse({ type: ReportRunDto, isArray: true })
  reports(@Query() query: LimitQueryDto) {
    return this.system.reports(limit(query.limit));
  }

  @Get('calendar')
  @ApiOperation({ summary: 'List trading-calendar rows' })
  @ApiOkResponse({ type: TradingCalendarDto, isArray: true })
  calendar(@Query() query: CalendarQueryDto) {
    return this.system.calendar({
      from: query.from,
      to: query.to,
      exchangeCode: query.exchangeCode,
    });
  }

  @Get('risk-events')
  @ApiOperation({ summary: 'List risk events' })
  @ApiOkResponse({ type: RiskEventDto, isArray: true })
  riskEvents(@Query() query: AccountFeedQueryDto) {
    return this.system.riskEvents({
      accountId: query.accountId,
      limit: limit(query.limit, 50),
    });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List trading sessions' })
  @ApiOkResponse({ type: TradingSessionDto, isArray: true })
  sessions(@Query() query: AccountFeedQueryDto) {
    return this.system.sessions({
      accountId: query.accountId,
      limit: limit(query.limit, 50),
    });
  }
}
