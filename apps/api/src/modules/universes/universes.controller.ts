import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UniversesService } from './universes.service.js';

@ApiTags('universes')
@ApiBearerAuth()
@Controller('universes')
export class UniversesController {
  constructor(private readonly universes: UniversesService) {}

  @Get()
  list() {
    return this.universes.list();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.universes.detail(id);
  }

  @Get(':id/versions')
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.universes.versions(id);
  }
}
