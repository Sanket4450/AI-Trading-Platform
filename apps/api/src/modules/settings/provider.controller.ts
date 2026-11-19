import {
  Controller,
  ForbiddenException,
  Get,
  Post,
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
import { JobRunDto } from '../../common/dto/job-run.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { ProviderStatusDto } from './dto/provider-response.dto.js';
import { ProviderService } from './provider.service.js';

function assertAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'admin') {
    throw new ForbiddenException('This operation requires the admin user role');
  }
}

@ApiTags('settings')
@ApiSessionAuth()
@Controller('settings')
export class ProviderController {
  constructor(private readonly provider: ProviderService) {}

  @Get('provider')
  @ApiOperation({
    summary: 'Return provider configuration, budget and ingestion state',
  })
  @ApiOkResponse({ type: ProviderStatusDto })
  status() {
    return this.provider.status();
  }

  @Post('provider/instruments/sync')
  @ApiOperation({ summary: 'Queue an instrument-master sync (admin only)' })
  @ApiCreatedResponse({ type: JobRunDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Requires the admin user role',
  })
  instrumentSync(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.provider.instrumentSync(user.id, requestMeta(request));
  }

  @Post('trading-calendar/sync')
  @ApiOperation({ summary: 'Queue a trading-calendar sync (admin only)' })
  @ApiCreatedResponse({ type: JobRunDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Requires the admin user role',
  })
  calendarSync(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.provider.calendarSync(user.id, requestMeta(request));
  }

  @Post('maintenance/daily-stats/refresh')
  @ApiOperation({ summary: 'Queue a materialized-view refresh' })
  @ApiCreatedResponse({ type: JobRunDto })
  refreshDailyStats(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.provider.refreshDailyStats(user.id, requestMeta(request));
  }
}
