import { Module } from '@nestjs/common';
import { PaymentPersistenceService } from './payment-persistence.service';
import { ProviderWebhookInboxService } from '../commerce/provider-webhook-inbox.service';
import { ProviderReconciliationIngestionService } from './provider-reconciliation-ingestion';
import { ProviderWebhookVerificationPersistenceService } from '../commerce/provider-webhook-verification-persistence.service';

@Module({
  providers: [PaymentPersistenceService, ProviderWebhookInboxService, ProviderWebhookVerificationPersistenceService,
    ProviderReconciliationIngestionService],
  exports: [PaymentPersistenceService, ProviderWebhookInboxService, ProviderWebhookVerificationPersistenceService,
    ProviderReconciliationIngestionService],
})
export class PaymentHubModule {}
