import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { SearchOffsetQueryDto } from '../../common/pagination/search-offset-query.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { CreateStrategyVersionDto } from './dto/create-strategy-version.dto.js';
import { CreateEvaluationRunDto } from './dto/create-evaluation-run.dto.js';
import { EffectiveConfigQueryDto } from './dto/effective-config-query.dto.js';
import {
  EvaluationResultQueryDto,
  EvaluationRunQueryDto,
  RunSignalQueryDto,
  SignalQueryDto,
} from './dto/evaluation-query.dto.js';
import {
  EvaluationResultListResponseDto,
  EvaluationRunDetailDto,
  EvaluationRunListResponseDto,
  ResearchSignalDetailDto,
  ResearchSignalListResponseDto,
} from './dto/evaluation-response.dto.js';
import {
  EffectiveConfigurationDto,
  StrategyDetailDto,
  StrategyListResponseDto,
  StrategySummaryDto,
  StrategyVersionDto,
} from './dto/strategy-response.dto.js';
import { StrategiesService } from './strategies.service.js';

function assertAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'admin') {
    throw new ForbiddenException('This operation requires the admin user role');
  }
}

@ApiTags('strategies')
@ApiSessionAuth()
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategies: StrategiesService) {}

  @Get()
  @ApiOperation({
    summary: 'List strategies with version, activation and runtime status',
  })
  @ApiOkResponse({ type: StrategyListResponseDto })
  list(@Query() query: SearchOffsetQueryDto) {
    return this.strategies.list(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Summarise strategies, versions and activations' })
  @ApiOkResponse({ type: StrategySummaryDto })
  summary(@Query() query: SearchOffsetQueryDto) {
    return this.strategies.summary(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Return a strategy with versions, bindings, activations and runtime',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StrategyDetailDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Strategy not found',
  })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.strategies.detail(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List strategy versions with runtime status' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StrategyVersionDto, isArray: true })
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.strategies.versions(id);
  }

  @Get(':id/versions/:versionId/effective-config')
  @ApiOperation({
    summary: 'Resolve the configuration bound to a role at a point in time',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiOkResponse({ type: EffectiveConfigurationDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Strategy version not found or no configuration is effective',
  })
  effectiveConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Query() query: EffectiveConfigQueryDto,
  ) {
    return this.strategies.effectiveConfiguration(
      id,
      versionId,
      query.role ?? 'parameters',
      query.at,
    );
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create a draft strategy version' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: StrategyVersionDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Strategy not found',
  })
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateStrategyVersionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.strategies.createVersion(
      id,
      body,
      user.id,
      requestMeta(request),
    );
  }

  @Post(':id/evaluation-runs')
  @HttpCode(202)
  @ApiOperation({ summary: 'Create and enqueue a research evaluation run (admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiAcceptedResponse({ type: EvaluationRunDetailDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Requires the admin user role' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Strategy or version not found' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'An active run already exists' })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'Version not runnable, configuration invalid, account or index missing',
  })
  createEvaluationRun(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEvaluationRunDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.strategies.createEvaluationRun(id, body, user.id, requestMeta(request));
  }

  @Get(':id/evaluation-runs')
  @ApiOperation({ summary: 'List evaluation runs for a strategy' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EvaluationRunListResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Strategy not found' })
  listEvaluationRuns(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EvaluationRunQueryDto,
  ) {
    return this.strategies.listEvaluationRuns(id, query);
  }

  @Get(':id/evaluation-runs/:runId')
  @ApiOperation({ summary: 'Return one evaluation run with pinned inputs and summary' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'runId', format: 'uuid' })
  @ApiOkResponse({ type: EvaluationRunDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Run not found under the strategy' })
  evaluationRunDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return this.strategies.evaluationRunDetail(id, runId);
  }

  @Get(':id/evaluation-runs/:runId/results')
  @ApiOperation({ summary: 'List per-instrument-day results for one run' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'runId', format: 'uuid' })
  @ApiOkResponse({ type: EvaluationResultListResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Run not found under the strategy' })
  listEvaluationResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Query() query: EvaluationResultQueryDto,
  ) {
    return this.strategies.listEvaluationResults(id, runId, query);
  }

  @Get(':id/evaluation-runs/:runId/signals')
  @ApiOperation({ summary: 'List research signals for one run' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'runId', format: 'uuid' })
  @ApiOkResponse({ type: ResearchSignalListResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Run not found under the strategy' })
  listRunSignals(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Query() query: RunSignalQueryDto,
  ) {
    return this.strategies.listRunSignals(id, runId, query);
  }

  @Post(':id/evaluation-runs/:runId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cooperively cancel an evaluation run (admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'runId', format: 'uuid' })
  @ApiOkResponse({ type: EvaluationRunDetailDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Requires the admin user role' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Run not found under the strategy' })
  cancelEvaluationRun(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.strategies.cancelEvaluationRun(id, runId, user.id, requestMeta(request));
  }

  @Get(':id/signals')
  @ApiOperation({ summary: 'List research signals across runs for a strategy' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ResearchSignalListResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Strategy not found' })
  listStrategySignals(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SignalQueryDto,
  ) {
    return this.strategies.listStrategySignals(id, query);
  }

  @Get(':id/signals/:signalId')
  @ApiOperation({ summary: 'Return one signal with its full evidence object' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'signalId', format: 'uuid' })
  @ApiOkResponse({ type: ResearchSignalDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Signal not found under the strategy' })
  signalDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('signalId', ParseUUIDPipe) signalId: string,
  ) {
    return this.strategies.signalDetail(id, signalId);
  }
}
