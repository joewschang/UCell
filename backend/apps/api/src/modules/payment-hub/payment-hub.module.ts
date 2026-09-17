import { Module } from '@nestjs/common';
import { PaymentPersistenceService } from './payment-persistence.service';
import { ProviderWebhookInboxService } from '../commerce/provider-webhook-inbox.service';
import { ProviderReconciliationIngestionService } from './provider-reconciliation-ingestion';

@Module({
  providers: [PaymentPersistenceService, ProviderWebhookInboxService, ProviderReconciliationIngestionService],
  exports: [PaymentPersistenceService, ProviderWebhookInboxService, ProviderReconciliationIngestionService],
})
export class PaymentHubModule {}
