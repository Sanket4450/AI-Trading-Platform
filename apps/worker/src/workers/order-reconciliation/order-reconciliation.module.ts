import { Module } from '@nestjs/common';
import { OrderReconciliationService } from './order-reconciliation.service.js';

@Module({
  providers: [OrderReconciliationService],
})
export class OrderReconciliationModule {}
