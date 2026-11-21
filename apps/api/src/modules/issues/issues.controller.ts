import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { SystemIssueDto } from '../../common/dto/system-issue.dto.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { IssuesService } from './issues.service.js';
import { SystemIssueQueryDto } from './system-issue-query.dto.js';

@ApiTags('issues')
@ApiSessionAuth()
@Controller('issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get()
  @ApiOperation({ summary: 'List active issues across every mechanism' })
  @ApiOkResponse({ type: SystemIssueDto, isArray: true })
  list(@Query() query: SystemIssueQueryDto) {
    return this.issues.list(query);
  }

  @Get(':issueId')
  @ApiOperation({ summary: 'Return one active issue with its payload' })
  @ApiParam({ name: 'issueId', format: 'uuid' })
  @ApiOkResponse({ type: SystemIssueDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Issue not found' })
  detail(@Param('issueId', ParseUUIDPipe) issueId: string) {
    return this.issues.detail(issueId);
  }
}
