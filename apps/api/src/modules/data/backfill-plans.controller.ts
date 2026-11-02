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
import { BackfillPlanService } from './backfill-plan.service.js';
import {
  CreateBackfillPlanDto,
  FetchInstrumentsDto,
} from './dto/r2-data.dto.js';

@ApiTags('data')
@ApiBearerAuth()
@Controller('data')
export class BackfillPlansController {
  constructor(private readonly plans: BackfillPlanService) {}

  @Post('instruments/fetch')
  fetch(
    @Body() body: FetchInstrumentsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.plans.fetchInstruments(body, user.id, requestMeta(request));
  }

  @Post('instruments/:instrumentId/retry')
  retryInstrument(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.plans.retryInstrument(
      instrumentId,
      user.id,
      requestMeta(request),
    );
  }

  @Post('instruments/:instrumentId/cancel')
  cancelInstrument(
    @Param('instrumentId', ParseUUIDPipe) instrumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.plans.cancelInstrument(
      instrumentId,
      user.id,
      requestMeta(request),
    );
  }

  @Post('backfill-plans')
  create(
    @Body() body: CreateBackfillPlanDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (body.dryRun !== false) return this.plans.preview(body);
    return this.plans.launch(body, user.id, requestMeta(request));
  }

  @Get('backfill-plans')
  list(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.plans.list(
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50,
    );
  }

  @Get('backfill-plans/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.detail(id);
  }

  @Get('backfill-plans/:id/children')
  children(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.childJobs(id);
  }

  @Post('backfill-plans/:id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.plans.cancelPlan(id, user.id, requestMeta(request));
  }

  @Post('backfill-plans/:id/retry-failed')
  retryFailed(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.plans.retryFailed(id, user.id, requestMeta(request));
  }
}
