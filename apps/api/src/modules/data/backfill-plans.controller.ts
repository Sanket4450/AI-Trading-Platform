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
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
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
import { BackfillPlanService } from './backfill-plan.service.js';
import {
  BackfillLaunchResponseDto,
  BackfillPlanChunkDto,
  BackfillPlanDetailDto,
  BackfillPlanDto,
  BackfillPreviewDto,
  CancelInstrumentResponseDto,
  FetchInstrumentsResponseDto,
} from './dto/data-response.dto.js';
import {
  CreateBackfillPlanDto,
  FetchInstrumentsDto,
} from './dto/r2-data.dto.js';

@ApiTags('data')
@ApiSessionAuth()
@ApiExtraModels(BackfillPreviewDto, BackfillLaunchResponseDto)
@Controller('data')
export class BackfillPlansController {
  constructor(private readonly plans: BackfillPlanService) {}

  @Post('instruments/fetch')
  @ApiOperation({
    summary: 'Preview or launch an instrument-scoped historical fetch',
    description:
      'dryRun defaults to true so the response is a plan preview. Set dryRun=false to enqueue work.',
  })
  @ApiCreatedResponse({ type: FetchInstrumentsResponseDto })
  fetch(
    @Body() body: FetchInstrumentsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.plans.fetchInstruments(body, user.id, requestMeta(request));
  }

  @Post('instruments/:instrumentId/cancel')
  @ApiOperation({ summary: 'Cancel the active backfill run for one instrument' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiCreatedResponse({ type: CancelInstrumentResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'No active backfill run for this instrument',
  })
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
  @ApiOperation({
    summary: 'Preview or launch a multi-instrument backfill plan',
    description:
      'dryRun defaults to true. A force refresh requires a reason. Existing active runs are reported, not duplicated.',
  })
  @ApiCreatedResponse({
    description:
      'A BackfillPreviewDto for dry-run requests, otherwise a BackfillLaunchResponseDto.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(BackfillPreviewDto) },
        { $ref: getSchemaPath(BackfillLaunchResponseDto) },
      ],
    },
  })
  create(
    @Body() body: CreateBackfillPlanDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (body.dryRun !== false) return this.plans.preview(body);
    return this.plans.launch(body, user.id, requestMeta(request));
  }

  @Get('backfill-plans')
  @ApiOperation({ summary: 'List backfill plans with progress counters' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiOkResponse({ type: BackfillPlanDto, isArray: true })
  list(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.plans.list(
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50,
    );
  }

  @Get('backfill-plans/:id')
  @ApiOperation({ summary: 'Return a backfill plan with its chunk runs' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BackfillPlanDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Backfill plan not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.detail(id);
  }

  @Get('backfill-plans/:id/children')
  @ApiOperation({ summary: 'List a backfill plan’s chunk runs' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BackfillPlanChunkDto, isArray: true })
  children(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.childJobs(id);
  }

  @Post('backfill-plans/:id/cancel')
  @ApiOperation({ summary: 'Cancel a backfill plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: JobRunDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Backfill plan not found' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.plans.cancelPlan(id, user.id, requestMeta(request));
  }
}
