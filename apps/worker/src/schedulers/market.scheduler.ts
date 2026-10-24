import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MarketScheduler {
  private readonly logger = new Logger(MarketScheduler.name);

  @Cron('0 15 15 * * 1-5', { timeZone: 'Asia/Kolkata' })
  endOfDaySquareOffWindow() {
    this.logger.log('End-of-day square-off window reached');
  }

  @Cron('0 0 8 * * 1-5', { timeZone: 'Asia/Kolkata' })
  preMarketPreparation() {
    this.logger.log('Pre-market preparation window reached');
  }
}
