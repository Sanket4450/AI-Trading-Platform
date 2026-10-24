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
import { CreateStrategyVersionDto } from './dto/create-strategy-version.dto.js';
import { StrategiesService } from './strategies.service.js';

@ApiTags('strategies')
@ApiBearerAuth()
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategies: StrategiesService) {}

  @Get()
  list() {
    return this.strategies.list();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.strategies.detail(id);
  }

  @Get(':id/versions')
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.strategies.versions(id);
  }

  @Get(':id/versions/:versionId/effective-config')
  effectiveConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Query('role') role = 'parameters',
    @Query('at') at?: string,
  ) {
    return this.strategies.effectiveConfiguration(id, versionId, role, at);
  }

  @Post(':id/versions')
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
