import { Module } from '@nestjs/common';
import { LiveMarketDataService } from './live-market-data.service.js';

@Module({
  providers: [LiveMarketDataService]
})
export class LiveMarketDataModule {}
