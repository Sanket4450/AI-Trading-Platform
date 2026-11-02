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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { CatalogService } from './catalog.service.js';
import {
  InstrumentStatusQueryDto,
  RecomputeStatusDto,
} from './dto/r2-data.dto.js';

@ApiTags('data')
@ApiBearerAuth()
@Controller('data')
export class InstrumentStatusController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('instrument-status')
  list(@Query() query: InstrumentStatusQueryDto) {
    return this.catalog.instrumentStatus(query);
  }

  @Get('instrument-status/summary')
  summary(@Query('universeCode') universeCode?: string) {
    return this.catalog.catalogSummary(universeCode);
  }

  @Post('instrument-status/recompute')
  recompute(
    @Body() body: RecomputeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.catalog.recomputeStatus(body, user.id, requestMeta(request));
  }

  @Get('instrument-status/:instrumentId')
  detail(@Param('instrumentId', ParseUUIDPipe) instrumentId: string) {
    return this.catalog.instrumentStatusDetail(instrumentId);
  }
}
