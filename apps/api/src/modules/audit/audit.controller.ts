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
import { AuditService } from './audit.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';
import {
  AuditDetailDto,
  AuditListResponseDto,
  AuditSummaryDto,
} from './dto/audit-response.dto.js';

@ApiTags('audit')
@ApiSessionAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit entries, newest first' })
  @ApiOkResponse({ type: AuditListResponseDto })
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Summarise the filtered audit set' })
  @ApiOkResponse({ type: AuditSummaryDto })
  summary(@Query() query: AuditQueryDto) {
    return this.audit.summary(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return one audit entry with its state snapshots' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AuditDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Audit entry not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.detail(id);
  }
}
