import { Module } from '@nestjs/common';
import { PaymentPersistenceService } from './payment-persistence.service';
import { ProviderWebhookInboxService } from '../commerce/provider-webhook-inbox.service';
import { ProviderReconciliationIngestionService } from './provider-reconciliation-ingestion';
import { ProviderWebhookVerificationPersistenceService } from '../commerce/provider-webhook-verification-persistence.service';
import { ProviderWebhookWorkerLeaseService } from '../commerce/provider-webhook-worker-lease.service';

@Module({
  providers: [PaymentPersistenceService, ProviderWebhookInboxService, ProviderWebhookVerificationPersistenceService,
    ProviderWebhookWorkerLeaseService, ProviderReconciliationIngestionService],
  exports: [PaymentPersistenceService, ProviderWebhookInboxService, ProviderWebhookVerificationPersistenceService,
    ProviderWebhookWorkerLeaseService, ProviderReconciliationIngestionService],
})
export class PaymentHubModule {}
