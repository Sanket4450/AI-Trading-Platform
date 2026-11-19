import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { IngestionRunDetailDto } from './dto/instrument-coverage.dto.js';
import { InstrumentRunsService } from './instrument-runs.service.js';

@ApiTags('instruments')
@ApiSessionAuth()
@Controller('instruments')
export class InstrumentRunsController {
  constructor(private readonly runs: InstrumentRunsService) {}

  @Get('runs/:runId')
  @ApiOperation({
    summary: 'Return an ingestion run with its archived raw payload metadata',
  })
  @ApiParam({ name: 'runId', format: 'uuid' })
  @ApiOkResponse({ type: IngestionRunDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Ingestion run not found' })
  detail(@Param('runId', ParseUUIDPipe) runId: string) {
    return this.runs.detail(runId);
  }
}
