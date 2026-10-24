import { Module } from '@nestjs/common';
import { HistoricalDataService } from './historical-data.service.js';

@Module({
  providers: [HistoricalDataService]
})
export class HistoricalDataModule {}
