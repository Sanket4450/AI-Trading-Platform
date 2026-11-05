import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProcessQueryDto } from './dto/process-query.dto.js';
import { ProcessesService } from './processes.service.js';

@ApiTags('processes')
@ApiBearerAuth()
@Controller('processes')
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Get()
  list(@Query() query: ProcessQueryDto) {
    return this.processes.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.processes.detail(id);
  }
}
