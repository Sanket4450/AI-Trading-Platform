import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import {
  ProcessDetailDto,
  ProcessListResponseDto,
} from './dto/process-response.dto.js';
import { ProcessQueryDto } from './dto/process-query.dto.js';
import { ProcessesService } from './processes.service.js';

@ApiTags('processes')
@ApiSessionAuth()
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Get()
  @ApiOperation({ summary: 'List background job runs with a 24-hour summary' })
  @ApiOkResponse({ type: ProcessListResponseDto })
  list(@Query() query: ProcessQueryDto) {
    return this.processes.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a job run with stages, metrics and events' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProcessDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Process not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.processes.detail(id);
  }
}
