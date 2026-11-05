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
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { InstrumentsService } from './instruments.service.js';
import { InstrumentCandlesQueryDto } from './dto/instrument-candles-query.dto.js';
import {
  CandleDto,
  CorporateActionDto,
  InstrumentDto,
  InstrumentMappingDto,
} from './dto/instrument-response.dto.js';
import { ListInstrumentsDto } from './dto/list-instruments.dto.js';

@ApiTags('instruments')
@ApiSessionAuth()
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Search the instrument master' })
  @ApiOkResponse({ type: InstrumentDto, isArray: true })
  list(@Query() query: ListInstrumentsDto) {
    return this.instruments.list(query);
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
  @ApiOperation({ summary: 'List provider mappings for an instrument' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InstrumentMappingDto, isArray: true })
  mappings(@Param('id', ParseUUIDPipe) id: string) {
    return this.instruments.mappings(id);
  }

  @Get(':id/corporate-actions')
  @ApiOperation({ summary: 'List corporate actions for an instrument' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CorporateActionDto, isArray: true })
  corporateActions(@Param('id', ParseUUIDPipe) id: string) {
    return this.instruments.corporateActions(id);
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
