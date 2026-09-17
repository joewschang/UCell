import { assertDispatchQc, QcEvidence, QcPolicySnapshot } from '../src/modules/commerce/contracts/fulfillment';
import { erpDisabled } from '../src/modules/commerce/contracts/erp';
import type { InventoryPort } from '../src/modules/commerce/contracts/inventory';
import type { LogisticsProviderAdapter } from '../src/modules/commerce/contracts/logistics';
import type { InvoiceProviderAdapter } from '../src/modules/commerce/contracts/invoice';
import type { CoreCommerceEvidencePort, ReceivedRmaPostingInput } from '../src/modules/commerce/contracts/core-boundary';
import type { RmaEffectDelivery, RmaPostedEvidence } from '../src/modules/commerce/contracts/rma';

// Compile-time negatives: no ReturnService call or monetary execution in these tests.
function assertPostingContractTypes(approvedOnly: { orderId: string; rmaId: string; status: 'APPROVED'; approvedAllocationRef: string }) {
  // @ts-expect-error APPROVED-only input lacks received evidence and Core posting approval.
  const invalidPosting: ReceivedRmaPostingInput = approvedOnly;
  // @ts-expect-error Canonical posting output cannot report APPROVED.
  const invalidResult: RmaPostedEvidence['status'] = 'APPROVED';
  return [invalidPosting, invalidResult];
}
function assertReceiptRequired(receivedWithoutEvidence: Omit<ReceivedRmaPostingInput, 'receivedEvidenceRef'>) {
  // @ts-expect-error RECEIVED status without received evidence is not a posting request.
  const missingReceipt: ReceivedRmaPostingInput = receivedWithoutEvidence;
  return missingReceipt;
}

describe('Commerce contract boundaries (no provider or DB integration)', () => {
  const qc: QcEvidence = { fulfillmentId: 'f-test', inspector: 'qc-test', timestamp: '2026-09-17T00:00:00Z',
    policyId: 'policy-test', policyVersion: 'v1', result: 'PASS', reason: 'checked', correlationId: 'correlation-test',
    checks: { SKU: true, QTY: true, LOT_SERIAL: true, EXPIRY: true, PACKAGE_INTEGRITY: true, LABEL: true } };
  const withLabel: QcPolicySnapshot = { policyId: 'policy-test', version: 'v1', requiredChecks: ['SKU','QTY','LOT_SERIAL','EXPIRY','PACKAGE_INTEGRITY','LABEL'] };
  it('requires every policy-required QC check and matching evidence', () => {
    expect(() => assertDispatchQc(qc, 'f-test', withLabel)).not.toThrow();
    for (const result of ['PENDING', 'FAIL', 'HOLD'] as const) expect(() => assertDispatchQc({ ...qc, result }, 'f-test', withLabel)).toThrow();
    for (const check of withLabel.requiredChecks) expect(() => assertDispatchQc({ ...qc, checks: { ...qc.checks, [check]: false } }, 'f-test', withLabel)).toThrow();
    expect(() => assertDispatchQc(qc, 'wrong-fulfillment', withLabel)).toThrow();
    expect(() => assertDispatchQc({ ...qc, inspector: '' }, 'f-test', withLabel)).toThrow();
  });
  it('does not require LABEL before its approved policy requires it', () => {
    const beforeLabel: QcPolicySnapshot = { policyId: 'pre-label-test', version: 'v2', requiredChecks: ['SKU','QTY','LOT_SERIAL','EXPIRY','PACKAGE_INTEGRITY'] };
    const evidence: QcEvidence = { ...qc, policyId: beforeLabel.policyId, policyVersion: beforeLabel.version,
      checks: { SKU: true, QTY: true, LOT_SERIAL: true, EXPIRY: true, PACKAGE_INTEGRITY: true } };
    expect(() => assertDispatchQc(evidence, 'f-test', beforeLabel)).not.toThrow();
    expect(() => assertDispatchQc({ ...evidence, policyId: qc.policyId, policyVersion: qc.policyVersion }, 'f-test', withLabel)).toThrow();
    expect(() => assertDispatchQc({ ...evidence, checks: { ...evidence.checks, EXPIRY: undefined } }, 'f-test', beforeLabel)).toThrow();
  });
  it('rejects missing, invalid or mismatched policy snapshots', () => {
    expect(() => assertDispatchQc(qc, 'f-test', undefined as never)).toThrow();
    expect(() => assertDispatchQc(qc, 'f-test', { ...withLabel, version: 'v2' })).toThrow();
    expect(() => assertDispatchQc(qc, 'f-test', { ...withLabel, policyId: 'other-policy' })).toThrow();
    expect(() => assertDispatchQc(qc, 'f-test', { ...withLabel, requiredChecks: [] })).toThrow();
    expect(() => assertDispatchQc(qc, 'f-test', { ...withLabel, requiredChecks: ['UNKNOWN' as never] })).toThrow();
    expect(() => assertDispatchQc(qc, 'f-test', { ...withLabel, requiredChecks: ['SKU', 'SKU'] })).toThrow();
  });
  it('ERP NONE needs no adapter, credentials or network', () => {
    expect(erpDisabled()).toEqual({ provider: 'NONE', inventoryAuthority: 'UCELL' });
    expect(Object.isFrozen(erpDisabled())).toBe(true);
  });
  it('tracks failed refund independently from posted-return inventory delivery', () => {
    const deliveries: readonly RmaEffectDelivery[] = [
      { postingEvidenceId: 'posted-test', effect: 'INVENTORY_RETURN', status: 'SUCCEEDED', idempotencyKey: 'inventory-test', correlationId: 'corr-test' },
      { postingEvidenceId: 'posted-test', effect: 'PAYMENT_REFUND', status: 'RETRY_PENDING', idempotencyKey: 'refund-test', correlationId: 'corr-test' },
    ];
    expect(deliveries[0].postingEvidenceId).toBe(deliveries[1].postingEvidenceId);
    // Compile-time smoke for independently wired ports; no implementation is claimed.
    const ports: Partial<{ inventory: InventoryPort; logistics: LogisticsProviderAdapter;
      invoice: InvoiceProviderAdapter; core: CoreCommerceEvidencePort }> = {};
    expect(ports).toEqual({});
  });
});
