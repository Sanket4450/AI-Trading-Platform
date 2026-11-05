import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { ReferenceDataService } from './reference-data.service.js';
import { CorporateActionImportResultDto } from './dto/data-response.dto.js';
import { CorporateActionImportDto } from './dto/r2-data.dto.js';

function assertAdmin(user: AuthenticatedUser): void {
  if (user.role !== 'admin') {
    throw new ForbiddenException('This operation requires the admin user role');
  }
}

@ApiTags('data')
@ApiSessionAuth()
@ApiForbiddenResponse({
  type: ErrorResponseDto,
  description: 'Requires the admin user role',
})
@Controller('data/reference')
export class ReferenceDataController {
  constructor(private readonly reference: ReferenceDataService) {}

  @Post('instrument-sync')
  @ApiOperation({
    summary: 'Queue an instrument-master sync (admin only)',
  })
  @ApiCreatedResponse({ type: JobRunDto })
  instrumentSync(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.reference.instrumentSync(user.id, requestMeta(request));
  }

  @Post('calendar-sync')
  @ApiOperation({
    summary: 'Queue a trading-calendar sync (admin only)',
  })
  @ApiCreatedResponse({ type: JobRunDto })
  calendarSync(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.reference.calendarSync(user.id, requestMeta(request));
  }

  @Post('corporate-actions/import')
  @ApiOperation({
    summary: 'Validate or import corporate-action rows (admin only)',
    description:
      'Supply either rows or CSV. dryRun=true validates without writing and still records per-row results.',
  })
  @ApiCreatedResponse({ type: CorporateActionImportResultDto })
  importCorporateActions(
    @Body() body: CorporateActionImportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    assertAdmin(user);
    return this.reference.importActions(body, user.id, requestMeta(request));
  }
}
