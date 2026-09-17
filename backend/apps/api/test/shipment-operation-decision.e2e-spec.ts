import { assertDispatchQc, QcEvidence, QcPolicySnapshot } from '../src/modules/commerce/contracts/fulfillment';
import type { LogisticsProviderAdapter, TrackingFact } from '../src/modules/commerce/contracts/logistics';
import { ProviderRegistry } from '../src/modules/commerce/contracts/provider-registry';
import {
  decideShipmentOperation,
  decideTrackingProjection,
  PersistedShipmentOperationClaim,
  ShipmentOperationCommand,
} from '../src/modules/commerce/shipment-operation-decision.service';

const command: ShipmentOperationCommand = {
  shipmentId: 'shipment-1', fulfillmentId: 'fulfillment-1', provider: 'BLACK_CAT',
  connectionVersionId: 'black-cat-v1', operationId: 'create-1', idempotencyKey: 'shipment-create-1',
  parcelSnapshotRef: 'parcel-snapshot-1', qcEvidenceRef: 'qc-evidence-1',
};

const policy: QcPolicySnapshot = { policyId: 'dispatch-qc', version: 'v1', requiredChecks: ['SKU', 'QTY'] };
const qc: QcEvidence = {
  fulfillmentId: 'fulfillment-1', inspector: 'operator-1', timestamp: '2026-09-18T10:00:00.000Z',
  policyId: 'dispatch-qc', policyVersion: 'v1', result: 'PASS', reason: 'dispatch verified',
  correlationId: 'correlation-1', checks: { SKU: true, QTY: true },
};

function completeClaim(operationHash: string): PersistedShipmentOperationClaim {
  return { operationHash, shipmentEvidenceRef: 'shipment-evidence-1', providerEvidenceRef: 'provider-evidence-1', outboxIntentRef: 'outbox-1' };
}

function tracking(status: TrackingFact['status'], eventTime: string): TrackingFact {
  return { shipmentId: 'shipment-1', providerShipmentRef: 'carrier-1', eventIdentity: `event-${status}-${eventTime}`,
    status, eventTime, rawStatusCode: status };
}

describe('Shipment and fulfillment pure decision contracts', () => {
  it('fails closed while provider configuration is pending', () => {
    const adapter = { provider: 'BLACK_CAT' } as LogisticsProviderAdapter;
    const registry = new ProviderRegistry([adapter], { BLACK_CAT: 'CONFIG_PENDING' }, ['BLACK_CAT', 'SEVEN_ELEVEN', 'ECPAY_LOGISTICS', 'OTHER'] as const);
    expect(() => registry.resolve('BLACK_CAT')).toThrow(expect.objectContaining({ code: 'PROVIDER_CONFIG_PENDING' }));
  });

  it('blocks dispatch when required QC evidence is incomplete', () => {
    expect(() => assertDispatchQc({ ...qc, checks: { SKU: true } }, 'fulfillment-1', policy)).toThrow('QC_DISPATCH_BLOCKED');
    expect(() => assertDispatchQc(qc, 'fulfillment-1', policy)).not.toThrow();
  });

  it('returns a deterministic replay only for the same content hash and complete operation claim', () => {
    const first = decideShipmentOperation({ command, existingClaim: null });
    expect(first.operationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(decideShipmentOperation({ command, existingClaim: completeClaim(first.operationHash) }).action).toBe('NOOP_REPLAY');
  });

  it('rejects content hash mismatch for an existing idempotency claim', () => {
    const first = decideShipmentOperation({ command, existingClaim: null });
    expect(() => decideShipmentOperation({
      command: { ...command, parcelSnapshotRef: 'different-parcel' }, existingClaim: completeClaim(first.operationHash),
    })).toThrow(expect.objectContaining({ code: 'SHIPMENT_OPERATION_CONFLICT' }));
  });

  it.each(['shipmentEvidenceRef', 'providerEvidenceRef', 'outboxIntentRef'] as const)(
    'rejects duplicate claim when %s is missing from the atomic result', field => {
      const first = decideShipmentOperation({ command, existingClaim: null });
      expect(() => decideShipmentOperation({ command, existingClaim: { ...completeClaim(first.operationHash), [field]: '' } }))
        .toThrow(expect.objectContaining({ code: 'SHIPMENT_OPERATION_CLAIM_INCOMPLETE' }));
    },
  );

  it('ignores older tracking facts without regressing shipment state', () => {
    const result = decideTrackingProjection({
      expected: { shipmentId: 'shipment-1', provider: 'BLACK_CAT', providerShipmentRef: 'carrier-1', currentStatus: 'IN_TRANSIT', currentEventTime: '2026-09-18T12:00:00.000Z' },
      callbackProvider: 'BLACK_CAT', fact: tracking('PICKED_UP', '2026-09-18T11:00:00.000Z'),
    });
    expect(result).toEqual({ action: 'IGNORE_STALE', nextStatus: 'IN_TRANSIT' });
  });

  it('rejects a newer callback that attempts an invalid state regression', () => {
    expect(() => decideTrackingProjection({
      expected: { shipmentId: 'shipment-1', provider: 'BLACK_CAT', providerShipmentRef: 'carrier-1', currentStatus: 'IN_TRANSIT', currentEventTime: '2026-09-18T12:00:00.000Z' },
      callbackProvider: 'BLACK_CAT', fact: tracking('PICKED_UP', '2026-09-18T13:00:00.000Z'),
    })).toThrow(expect.objectContaining({ code: 'TRACKING_TRANSITION_INVALID' }));
  });

  it.each([
    ['foreign provider', 'SEVEN_ELEVEN', tracking('DELIVERED', '2026-09-18T13:00:00.000Z')],
    ['foreign shipment', 'BLACK_CAT', { ...tracking('DELIVERED', '2026-09-18T13:00:00.000Z'), shipmentId: 'shipment-2' }],
    ['foreign provider reference', 'BLACK_CAT', { ...tracking('DELIVERED', '2026-09-18T13:00:00.000Z'), providerShipmentRef: 'carrier-2' }],
  ] as const)('rejects %s callback identity', (_label, callbackProvider, fact) => {
    expect(() => decideTrackingProjection({
      expected: { shipmentId: 'shipment-1', provider: 'BLACK_CAT', providerShipmentRef: 'carrier-1', currentStatus: 'IN_TRANSIT', currentEventTime: '2026-09-18T12:00:00.000Z' },
      callbackProvider, fact,
    })).toThrow(expect.objectContaining({ code: 'TRACKING_SOURCE_MISMATCH' }));
  });
});
