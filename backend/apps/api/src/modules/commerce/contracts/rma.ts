import type { Id, Timestamp, Money, CommandContext, SafeEvidenceRef, ProviderResult, ProviderContext, UntrustedWebhook, Verified, Verification } from './common';

export type RmaStatus = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'POSTED' | 'REFUNDED' | 'CLOSED' | 'REJECTED';
export type ReturnDisposition = 'RESTOCK' | 'QUARANTINE' | 'DISCARD';

/** Workflow outcomes are independent of the immutable Core-owned POSTED boundary. */
export type RmaPostedEvidence = Readonly<{ status: 'POSTED'; returnCaseId: Id; orderId: Id; postingEvidenceId: Id;
  postedAt: Timestamp; correlationId: Id }>;
export type RmaEffect = 'INVENTORY_RETURN' | 'PAYMENT_REFUND' | 'INVOICE_ADJUSTMENT' | 'CORE_REPLAY';
export type RmaEffectDelivery = Readonly<{ postingEvidenceId: Id; effect: RmaEffect;
  idempotencyKey: string; status: 'PENDING' | 'SUCCEEDED' | 'RETRY_PENDING' | 'MANUAL_REVIEW';
  correlationId: Id }>;
