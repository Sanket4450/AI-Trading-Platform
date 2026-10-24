import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SystemControlService } from './system-control.service.js';

function limit(value: string | undefined, fallback = 100): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, 500)
    : fallback;
}

@ApiTags('system')
@ApiBearerAuth()
@Controller('system')
export class SystemControlController {
  constructor(private readonly system: SystemControlService) {}

  @Get('status')
  status() {
    return this.system.status();
  }

  @Get('overview')
  overview() {
    return this.system.overview();
  }

  @Get('jobs')
  jobs(@Query('limit') limitValue?: string, @Query('status') status?: string) {
    return this.system.jobs(limit(limitValue), status);
  }

  @Get('health-snapshots')
  healthSnapshots(
    @Query('limit') limitValue?: string,
    @Query('component') component?: string,
  ) {
    return this.system.healthSnapshots(limit(limitValue), component);
  }

  @Get('notifications')
  notifications(@Query('limit') limitValue?: string) {
    return this.system.notifications(limit(limitValue));
  }

  @Get('reports')
  reports(@Query('limit') limitValue?: string) {
    return this.system.reports(limit(limitValue));
  }

  @Get('calendar')
  calendar(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('exchangeCode') exchangeCode?: string,
  ) {
    return this.system.calendar({ from, to, exchangeCode });
  }

  @Get('risk-events')
  riskEvents(
    @Query('accountId') accountId?: string,
    @Query('limit') limitValue?: string,
  ) {
    return this.system.riskEvents({ accountId, limit: limit(limitValue, 50) });
  }

  @Get('sessions')
  sessions(
    @Query('accountId') accountId?: string,
    @Query('limit') limitValue?: string,
  ) {
    return this.system.sessions({ accountId, limit: limit(limitValue, 50) });
  }
}
