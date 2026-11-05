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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
import { CreateStrategyVersionDto } from './dto/create-strategy-version.dto.js';
import { EffectiveConfigQueryDto } from './dto/effective-config-query.dto.js';
import {
  EffectiveConfigurationDto,
  StrategyDetailDto,
  StrategyDto,
  StrategyVersionDto,
} from './dto/strategy-response.dto.js';
import { StrategiesService } from './strategies.service.js';

@ApiTags('strategies')
@ApiSessionAuth()
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategies: StrategiesService) {}

  @Get()
  @ApiOperation({ summary: 'List strategies with version and activation counts' })
  @ApiOkResponse({ type: StrategyDto, isArray: true })
  list() {
    return this.strategies.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a strategy with versions, bindings and activations' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StrategyDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Strategy not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.strategies.detail(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List strategy versions' })
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
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Strategy not found' })
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
}
