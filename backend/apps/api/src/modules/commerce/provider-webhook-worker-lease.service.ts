import { Injectable } from '@nestjs/common';
import {
  PrismaService,
  ProviderWebhookWorkerLeaseService as SharedProviderWebhookWorkerLeaseService,
} from '@ucell/database';

export type {
  ClaimProviderWebhookBatchInput,
  FinalizeProviderWebhookOutcomeInput,
  FinalizeProviderWebhookOutcomeResult,
  ProviderWebhookWorkerLease,
  ScheduleProviderWebhookRetryInput,
} from '@ucell/database';

@Injectable()
export class ProviderWebhookWorkerLeaseService extends SharedProviderWebhookWorkerLeaseService {
  constructor(db: PrismaService) { super(db); }
}
