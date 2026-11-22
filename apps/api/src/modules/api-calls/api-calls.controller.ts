import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExternalApiCallListResponseDto } from '../../common/dto/external-api-call.dto.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { ApiCallsService } from './api-calls.service.js';
import { ApiCallQueryDto } from './dto/api-call-query.dto.js';

@ApiTags('api-calls')
@ApiSessionAuth()
@Controller('api-calls')
export class ApiCallsController {
  constructor(private readonly calls: ApiCallsService) {}

  @Get()
  @ApiOperation({ summary: 'List outbound API calls across every job, newest first' })
  @ApiOkResponse({ type: ExternalApiCallListResponseDto })
  list(@Query() query: ApiCallQueryDto) {
    return this.calls.list(query);
  }
}
