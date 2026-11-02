import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ReferenceDataService } from './reference-data.service.js';
import { CorporateActionImportDto } from './dto/r2-data.dto.js';

function assertAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'admin') {
    throw new ForbiddenException('This operation requires the admin user role');
  }
}

@ApiTags('data')
@ApiBearerAuth()
@Controller('data/reference')
export class ReferenceDataController {
  constructor(private readonly reference: ReferenceDataService) {}

  @Post('instrument-sync')
  instrumentSync(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.reference.instrumentSync(user.id, requestMeta(request));
  }

  @Post('calendar-sync')
  calendarSync(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.reference.calendarSync(user.id, requestMeta(request));
  }

  @Post('corporate-actions/import')
  importCorporateActions(
    @Body() body: CorporateActionImportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.reference.importActions(body, user.id, requestMeta(request));
  }
}
