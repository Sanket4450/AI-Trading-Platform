import { Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller.js';
import { MarketDataService } from './market-data.service.js';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService]
})
export class MarketDataModule {}
