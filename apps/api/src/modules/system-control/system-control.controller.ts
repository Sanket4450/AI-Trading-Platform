import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
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

function assertAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'admin') {
    throw new ForbiddenException('This operation requires the admin user role');
  }
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

  @Post('coverage/rebuild')
  @ApiOperation({
    summary: 'Queue a full rebuild of instrument day coverage',
    description:
      'Clears instrument_day_coverage and recomputes it for every sync target from 2022-01-01 to the latest completed session.',
  })
  @ApiCreatedResponse({ type: JobRunDto })
  rebuildCoverage(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.system.rebuildCoverage(user.id, requestMeta(request));
  }

  @Post('gaps/repair')
  @ApiOperation({
    summary: 'Queue a full-history provider-gap sweep (admin only)',
    description:
      'Force-refetches every instrument-day whose stored bars fall short of the session. A refetch that heals the day clears the gap; an identical refetch is recorded as a provider omission after three consecutive attempts. The same sweep runs on the first of each month at 08:45 IST.',
  })
  @ApiCreatedResponse({ type: JobRunDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Requires the admin user role',
  })
  repairGaps(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.system.repairGaps(user.id, requestMeta(request));
  }

  @Post('ingestion/reconcile')
  @ApiOperation({
    summary: 'Queue an ingestion reconciliation sweep (admin only)',
    description:
      'Recovers runs whose heartbeat expired or whose queue entry is gone, records each recovery as a stale-job issue and re-derives the affected instrument status. The same sweep runs on the 08:30 IST schedule.',
  })
  @ApiCreatedResponse({ type: JobRunDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Requires the admin user role',
  })
  reconcileIngestion(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.system.reconcileIngestion(user.id, requestMeta(request));
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
