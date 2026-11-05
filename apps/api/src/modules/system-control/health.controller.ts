import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator.js';
import { HealthResponseDto } from './dto/system-response.dto.js';
import { SystemControlService } from './system-control.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly system: SystemControlService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liveness/readiness probe',
    description:
      'Public endpoint. Reports API mode plus database and Redis checks; no session required.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  check() {
    return this.system.health();
  }
}
