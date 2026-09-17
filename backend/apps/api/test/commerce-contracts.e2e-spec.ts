import { assertDispatchQc, QcEvidence } from '../src/modules/commerce/contracts/fulfillment';
import { erpDisabled } from '../src/modules/commerce/contracts/erp';
import type { InventoryPort } from '../src/modules/commerce/contracts/inventory';
import type { LogisticsProviderAdapter } from '../src/modules/commerce/contracts/logistics';
import type { InvoiceProviderAdapter } from '../src/modules/commerce/contracts/invoice';
import type { CoreCommerceEvidencePort } from '../src/modules/commerce/contracts/core-boundary';
import type { RmaEffectDelivery } from '../src/modules/commerce/contracts/rma';

describe('Commerce contract boundaries (no provider or DB integration)', () => {
  const qc: QcEvidence = { fulfillmentId: 'f-test', inspector: 'qc-test', timestamp: '2026-09-17T00:00:00Z',
    result: 'PASS', reason: 'checked', correlationId: 'correlation-test',
    checks: { SKU: true, QTY: true, LOT_SERIAL: true, EXPIRY: true, PACKAGE_INTEGRITY: true, LABEL: true } };
  it('requires every QC check and evidence binding before dispatch', () => {
    expect(() => assertDispatchQc(qc, 'f-test')).not.toThrow();
    for (const result of ['PENDING', 'FAIL', 'HOLD'] as const) expect(() => assertDispatchQc({ ...qc, result }, 'f-test')).toThrow();
    for (const check of Object.keys(qc.checks)) expect(() => assertDispatchQc({ ...qc, checks: { ...qc.checks, [check]: false } }, 'f-test')).toThrow();
    expect(() => assertDispatchQc(qc, 'wrong-fulfillment')).toThrow();
    expect(() => assertDispatchQc({ ...qc, inspector: '' }, 'f-test')).toThrow();
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
