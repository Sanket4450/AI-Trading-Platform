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
import {
  UniverseDetailDto,
  UniverseDto,
  UniverseVersionDto,
} from './dto/universe-response.dto.js';
import { UniversesService } from './universes.service.js';

@ApiTags('universes')
@ApiSessionAuth()
@Controller('universes')
export class UniversesController {
  constructor(private readonly universes: UniversesService) {}

  @Get()
  @ApiOperation({ summary: 'List instrument universes' })
  @ApiOkResponse({ type: UniverseDto, isArray: true })
  list() {
    return this.universes.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a universe with all versions and members' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UniverseDetailDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Universe not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.universes.detail(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List versions of a universe' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UniverseVersionDto, isArray: true })
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.universes.versions(id);
  }
}
