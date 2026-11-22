import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { InstrumentsService } from './instruments.service.js';
import { InstrumentReferenceService } from './instrument-reference.service.js';
import { CorporateActionImportDto } from './dto/instrument-coverage-query.dto.js';
import { CorporateActionImportResultDto } from './dto/instrument-coverage.dto.js';
import { InstrumentCandlesQueryDto } from './dto/instrument-candles-query.dto.js';
import { CandleDto, InstrumentDto, InstrumentMappingDto } from './dto/instrument-response.dto.js';
import { OffsetQueryDto } from '../../common/pagination/pagination.dto.js';
import {
  CorporateActionListResponseDto,
  InstrumentListResponseDto,
} from './dto/instrument-list-response.dto.js';
import { ListInstrumentsDto } from './dto/list-instruments.dto.js';

@ApiTags('instruments')
@ApiSessionAuth()
@Controller('instruments')
export class InstrumentsController {
  constructor(
    private readonly instruments: InstrumentsService,
    private readonly reference: InstrumentReferenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search the instrument master' })
  @ApiOkResponse({ type: InstrumentListResponseDto })
  list(@Query() query: ListInstrumentsDto) {
    return this.instruments.list(query);
  }

  @Post('corporate-actions/import')
  @ApiOperation({
    summary: 'Validate or import corporate-action rows (admin only)',
    description:
      'Supply either rows or CSV. dryRun=true validates without writing and still records per-row results.',
  })
  @ApiCreatedResponse({ type: CorporateActionImportResultDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Requires the admin user role',
  })
  importCorporateActions(
    @Body() body: CorporateActionImportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('This operation requires the admin user role');
    }
    return this.reference.importActions(body, user.id, requestMeta(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return one instrument' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InstrumentDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Instrument not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.instruments.detail(id);
  }

  @Get(':id/mappings')
  @ApiOperation({
    summary: 'List all provider mappings for an instrument',
    description: 'Unpaginated: returns every mapping associated with the instrument.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InstrumentMappingDto, isArray: true })
  mappings(@Param('id', ParseUUIDPipe) id: string) {
    return this.instruments.mappings(id);
  }

  @Get(':id/corporate-actions')
  @ApiOperation({ summary: 'List corporate actions for an instrument' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CorporateActionListResponseDto })
  corporateActions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: OffsetQueryDto,
  ) {
    return this.instruments.corporateActions(id, query);
  }

  @Get(':id/candles')
  @ApiOperation({
    summary: 'List minute candles for an instrument',
    description: 'At most 5,000 candles are returned in ascending time order.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CandleDto, isArray: true })
  candles(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InstrumentCandlesQueryDto,
  ) {
    return this.instruments.candles(id, query.from, query.to);
  }
}
