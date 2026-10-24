import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator.js';
import { SystemControlService } from './system-control.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly system: SystemControlService) {}

  @Public()
  @Get()
  check() {
    return this.system.health();
  }
}
