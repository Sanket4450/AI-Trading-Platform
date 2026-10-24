import { Module } from '@nestjs/common';
import { EndOfDaySquareOffService } from './end-of-day-square-off.service.js';

@Module({
  providers: [EndOfDaySquareOffService],
})
export class EndOfDaySquareOffModule {}
