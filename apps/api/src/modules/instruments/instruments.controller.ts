import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListInstrumentsDto } from './dto/list-instruments.dto.js';
import { InstrumentsService } from './instruments.service.js';

@ApiTags('instruments')
@ApiBearerAuth()
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Get()
  list(@Query() query: ListInstrumentsDto) {
    return this.instruments.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.instruments.detail(id);
  }

  @Get(':id/mappings')
  mappings(@Param('id', ParseUUIDPipe) id: string) {
    return this.instruments.mappings(id);
  }

  @Get(':id/corporate-actions')
  corporateActions(@Param('id', ParseUUIDPipe) id: string) {
    return this.instruments.corporateActions(id);
  }

  @Get(':id/candles')
  candles(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.instruments.candles(id, from, to);
  }
}
