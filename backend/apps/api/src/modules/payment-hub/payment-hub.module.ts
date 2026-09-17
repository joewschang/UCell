import { Module } from '@nestjs/common';
import { PaymentPersistenceService } from './payment-persistence.service';

@Module({
  providers: [PaymentPersistenceService],
  exports: [PaymentPersistenceService],
})
export class PaymentHubModule {}
