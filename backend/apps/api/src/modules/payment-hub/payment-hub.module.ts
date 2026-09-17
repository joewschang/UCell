import { Module } from '@nestjs/common';
import { PaymentPersistenceService } from './payment-persistence.service';
import { ProviderWebhookInboxService } from '../commerce/provider-webhook-inbox.service';

@Module({
  providers: [PaymentPersistenceService, ProviderWebhookInboxService],
  exports: [PaymentPersistenceService, ProviderWebhookInboxService],
})
export class PaymentHubModule {}
