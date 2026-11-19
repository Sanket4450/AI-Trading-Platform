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
import {
  QualityIssueActionDto,
  QualityIssueDto,
} from '../../common/dto/quality-issue.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { ProviderIssueQueryDto } from './dto/provider-issue-query.dto.js';
import { ProviderIssueService } from './provider-issue.service.js';

@ApiTags('settings')
@ApiSessionAuth()
@Controller('settings')
export class ProviderIssuesController {
  constructor(private readonly issues: ProviderIssueService) {}

  @Get('issues')
  @ApiOperation({
    summary: 'List data-quality issues that are not tied to one instrument',
  })
  @ApiOkResponse({ type: QualityIssueDto, isArray: true })
  list(@Query() query: ProviderIssueQueryDto) {
    return this.issues.list(query);
  }

  @Get('issues/:issueId')
  @ApiOperation({ summary: 'Return one provider-wide data-quality issue' })
  @ApiParam({ name: 'issueId', format: 'uuid' })
  @ApiOkResponse({ type: QualityIssueDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Quality issue not found',
  })
  detail(@Param('issueId', ParseUUIDPipe) issueId: string) {
    return this.issues.detail(issueId);
  }

  @Post('issues/:issueId/acknowledge')
  @ApiOperation({ summary: 'Transition a provider-wide data-quality issue status' })
  @ApiParam({ name: 'issueId', format: 'uuid' })
  @ApiCreatedResponse({ type: QualityIssueDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Quality issue not found',
  })
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
