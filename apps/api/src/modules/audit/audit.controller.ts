import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { AuditService } from './audit.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';
import { AuditRowDto } from './dto/audit-response.dto.js';

@ApiTags('audit')
@ApiSessionAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit entries, newest first' })
  @ApiOkResponse({ type: AuditRowDto, isArray: true })
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
