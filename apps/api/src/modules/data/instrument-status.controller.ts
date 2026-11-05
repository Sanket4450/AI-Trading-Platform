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
  ApiQuery,
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
import { CatalogService } from './catalog.service.js';
import {
  CatalogSummaryDto,
  InstrumentStatusDetailDto,
  InstrumentStatusRowDto,
} from './dto/data-response.dto.js';
import {
  InstrumentStatusQueryDto,
  RecomputeStatusDto,
} from './dto/r2-data.dto.js';

@ApiTags('data')
@ApiSessionAuth()
@Controller('data')
export class InstrumentStatusController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('instrument-status')
  @ApiOperation({ summary: 'List universe instruments with fetch/data status' })
  @ApiOkResponse({ type: InstrumentStatusRowDto, isArray: true })
  list(@Query() query: InstrumentStatusQueryDto) {
    return this.catalog.instrumentStatus(query);
  }

  @Get('instrument-status/summary')
  @ApiOperation({ summary: 'Summarise catalog fetch/data status for a universe' })
  @ApiQuery({
    name: 'universeCode',
    required: false,
    example: 'nifty-50',
  })
  @ApiOkResponse({ type: CatalogSummaryDto })
  summary(@Query('universeCode') universeCode?: string) {
    return this.catalog.catalogSummary(universeCode);
  }

  @Post('instrument-status/recompute')
  @ApiOperation({ summary: 'Queue a coverage-status recomputation' })
  @ApiCreatedResponse({ type: JobRunDto })
  recompute(
    @Body() body: RecomputeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.recomputeStatus(body, user.id, requestMeta(request));
  }

  @Get('instrument-status/:instrumentId')
  @ApiOperation({ summary: 'Return catalog status, monthly coverage, runs and issues' })
  @ApiParam({ name: 'instrumentId', format: 'uuid' })
  @ApiOkResponse({ type: InstrumentStatusDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Instrument not found' })
  detail(@Param('instrumentId', ParseUUIDPipe) instrumentId: string) {
    return this.catalog.instrumentStatusDetail(instrumentId);
  }
}
