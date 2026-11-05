import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import {
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
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { SystemSettingDto } from './dto/setting-response.dto.js';
import { UpdateSettingDto } from './dto/update-setting.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@ApiSessionAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List runtime system settings' })
  @ApiOkResponse({ type: SystemSettingDto, isArray: true })
  list() {
    return this.settings.list();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Create or update a runtime system setting' })
  @ApiParam({ name: 'key', example: 'risk.max_daily_loss' })
  @ApiOkResponse({ type: SystemSettingDto })
  update(
    @Param('key') key: string,
    @Body() body: UpdateSettingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.settings.update(key, body, user.id, requestMeta(request));
  }
}
