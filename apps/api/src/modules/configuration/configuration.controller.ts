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
import { ConfigurationService } from './configuration.service.js';
import {
  BindConfigurationDto,
  CreateConfigurationDto,
} from './dto/create-configuration.dto.js';
import { ListConfigurationDto } from './dto/list-configuration.dto.js';

@ApiTags('configuration')
@ApiBearerAuth()
@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  list(@Query() query: ListConfigurationDto) {
    return this.configuration.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.configuration.detail(id);
  }

  @Get(':id/diff')
  diff(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('against', ParseUUIDPipe) against: string,
  ) {
    return this.configuration.diff(id, against);
  }

  @Post()
  create(
    @Body() body: CreateConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.configuration.create(body, user.id, requestMeta(request));
  }

  @Post(':id/bind')
  bind(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BindConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.configuration.bind(id, body, user.id, requestMeta(request));
  }
}
