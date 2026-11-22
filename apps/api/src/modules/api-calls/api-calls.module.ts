import { Module } from '@nestjs/common';
import { ApiCallsController } from './api-calls.controller.js';
import { ApiCallsService } from './api-calls.service.js';

@Module({
  controllers: [ApiCallsController],
  providers: [ApiCallsService],
})
export class ApiCallsModule {}
