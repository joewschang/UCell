import type { Id, Timestamp, Money, CommandContext, SafeEvidenceRef, ProviderResult, ProviderContext, UntrustedWebhook, Verified, Verification } from './common';

export type FulfillmentStatus = 'READY' | 'ALLOCATED' | 'PICKING' | 'PICKED' | 'QC_PENDING'
  | 'QC_PASSED' | 'PACKED' | 'SHIPPING_REQUESTED' | 'SHIPPED' | 'DELIVERED' | 'EXCEPTION' | 'CANCELLED';
export type QcStatus = 'PENDING' | 'PASS' | 'FAIL' | 'HOLD';
export type QcCheck = 'SKU' | 'QTY' | 'LOT_SERIAL' | 'EXPIRY' | 'PACKAGE_INTEGRITY' | 'LABEL';

export type QcEvidence = Readonly<{ fulfillmentId: Id; inspector: Id; timestamp: Timestamp;
  result: QcStatus; reason: string; correlationId: Id; checks: Readonly<Record<QcCheck, boolean>> }>;
/** Pure guard only; reservation, scans and DB authority remain backend workflows. */
export function assertDispatchQc(evidence: QcEvidence, fulfillmentId: Id): void {
  const checks: readonly QcCheck[] = ['SKU','QTY','LOT_SERIAL','EXPIRY','PACKAGE_INTEGRITY','LABEL'];
  if (!evidence || evidence.fulfillmentId !== fulfillmentId || evidence.result !== 'PASS'
    || !evidence.inspector?.trim() || !evidence.correlationId?.trim()
    || !Number.isFinite(Date.parse(evidence.timestamp)) || !evidence.checks
    || checks.some(check => evidence.checks[check] !== true)) {
    throw new Error('QC_DISPATCH_BLOCKED');
  }
}
