import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import {
  QualityIssueActionDto,
  QualityIssueDto,
} from '../../common/dto/quality-issue.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { InstrumentIssuesService } from './instrument-issues.service.js';

@ApiTags('instruments')
@ApiSessionAuth()
@Controller('instruments')
export class InstrumentIssuesController {
  constructor(private readonly issues: InstrumentIssuesService) {}

  @Get('issues/:issueId')
  @ApiOperation({ summary: 'Return one instrument-scoped data-quality issue' })
  @ApiParam({ name: 'issueId', format: 'uuid' })
  @ApiOkResponse({ type: QualityIssueDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Quality issue not found' })
  detail(@Param('issueId', ParseUUIDPipe) issueId: string) {
    return this.issues.detail(issueId);
  }

  @Post('issues/:issueId/acknowledge')
  @ApiOperation({ summary: 'Transition an instrument data-quality issue status' })
  @ApiParam({ name: 'issueId', format: 'uuid' })
  @ApiCreatedResponse({ type: QualityIssueDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Quality issue not found' })
  acknowledge(
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() body: QualityIssueActionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.issues.acknowledge(
      issueId,
      body,
      user.id,
      requestMeta(request),
    );
  }
}
