import type { Id, Timestamp } from './common';

export type FulfillmentStatus = 'READY' | 'ALLOCATED' | 'PICKING' | 'PICKED' | 'QC_PENDING'
  | 'QC_PASSED' | 'PACKED' | 'SHIPPING_REQUESTED' | 'SHIPPED' | 'DELIVERED' | 'EXCEPTION' | 'CANCELLED';
export type QcStatus = 'PENDING' | 'PASS' | 'FAIL' | 'HOLD';
export type QcCheck = 'SKU' | 'QTY' | 'LOT_SERIAL' | 'EXPIRY' | 'PACKAGE_INTEGRITY' | 'LABEL';

export type QcPolicySnapshot = Readonly<{ policyId: Id; version: string; requiredChecks: readonly QcCheck[] }>;
export type QcEvidence = Readonly<{ fulfillmentId: Id; inspector: Id; timestamp: Timestamp;
  policyId: Id; policyVersion: string; result: QcStatus; reason: string; correlationId: Id;
  checks: Readonly<Partial<Record<QcCheck, boolean>>> }>;
/** Pure guard using a backend-loaded, versioned policy snapshot. This does not select
 * operational sequencing: LABEL may be required by a later policy after label creation. */
export function assertDispatchQc(evidence: QcEvidence, fulfillmentId: Id, policy: QcPolicySnapshot): void {
  const knownChecks: readonly QcCheck[] = ['SKU','QTY','LOT_SERIAL','EXPIRY','PACKAGE_INTEGRITY','LABEL'];
  if (!policy || typeof policy.policyId !== 'string' || !policy.policyId.trim()
    || typeof policy.version !== 'string' || !policy.version.trim()
    || !Array.isArray(policy.requiredChecks) || policy.requiredChecks.length === 0
    || new Set(policy.requiredChecks).size !== policy.requiredChecks.length
    || policy.requiredChecks.some(check => !knownChecks.includes(check))
    || !evidence || evidence.policyId !== policy.policyId || evidence.policyVersion !== policy.version
    || evidence.fulfillmentId !== fulfillmentId || evidence.result !== 'PASS'
    || !evidence.inspector?.trim() || !evidence.correlationId?.trim()
    || !Number.isFinite(Date.parse(evidence.timestamp)) || !evidence.checks
    || policy.requiredChecks.some((check: QcCheck) => evidence.checks[check] !== true)) {
    throw new Error('QC_DISPATCH_BLOCKED');
  }
}
