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
  ApiQuery,
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
import { ConfigurationService } from './configuration.service.js';
import {
  BindConfigurationDto,
  CreateConfigurationDto,
} from './dto/create-configuration.dto.js';
import {
  ConfigurationCreatedDto,
  ConfigurationDiffDto,
  ConfigurationVersionDto,
  StrategyConfigBindingDto,
} from './dto/configuration-response.dto.js';
import { ListConfigurationDto } from './dto/list-configuration.dto.js';

@ApiTags('configuration')
@ApiSessionAuth()
@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  @ApiOperation({ summary: 'List configuration versions' })
  @ApiOkResponse({ type: ConfigurationVersionDto, isArray: true })
  list(@Query() query: ListConfigurationDto) {
    return this.configuration.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a configuration version and its bindings' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ConfigurationVersionDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Configuration version not found',
  })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.configuration.detail(id);
  }

  @Get(':id/diff')
  @ApiOperation({ summary: 'Diff a configuration version against another' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({
    name: 'against',
    required: true,
    format: 'uuid',
    description: 'Configuration version to compare against.',
  })
  @ApiOkResponse({ type: ConfigurationDiffDto })
  diff(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('against', ParseUUIDPipe) against: string,
  ) {
    return this.configuration.diff(id, against);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a configuration version',
    description:
      'The payload is validated against the JSON schema for the config type/scope. Identical payload hashes return the existing version with created=false.',
  })
  @ApiCreatedResponse({ type: ConfigurationCreatedDto })
  create(
    @Body() body: CreateConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.configuration.create(body, user.id, requestMeta(request));
  }

  @Post(':id/bind')
  @ApiOperation({ summary: 'Bind a configuration version to a strategy version role' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: StrategyConfigBindingDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Configuration or strategy version not found',
  })
  bind(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BindConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.configuration.bind(id, body, user.id, requestMeta(request));
  }
}
