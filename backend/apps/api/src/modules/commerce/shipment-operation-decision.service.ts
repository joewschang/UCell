import { createHash } from 'node:crypto';
import type { ShipmentProviderCode, ShipmentStatus, TrackingFact } from './contracts/logistics';

export type ShipmentOperationCommand = Readonly<{
  shipmentId: string;
  fulfillmentId: string;
  provider: ShipmentProviderCode;
  connectionVersionId: string;
  operationId: string;
  idempotencyKey: string;
  parcelSnapshotRef: string;
  qcEvidenceRef: string;
}>;

export type PersistedShipmentOperationClaim = Readonly<{
  operationHash: string;
  shipmentEvidenceRef: string;
  providerEvidenceRef: string;
  outboxIntentRef: string;
}>;

export type ShipmentOperationDecision = Readonly<{
  action: 'APPLY' | 'NOOP_REPLAY';
  operationHash: string;
  canonicalCommand: ShipmentOperationCommand & { schemaVersion: 1 };
}>;

export type TrackingContext = Readonly<{
  shipmentId: string;
  provider: ShipmentProviderCode;
  providerShipmentRef: string;
  currentStatus: ShipmentStatus;
  currentEventTime: string;
}>;

export class ShipmentOperationDecisionError extends Error {
  constructor(
    readonly code:
      | 'SHIPMENT_OPERATION_CONTEXT_INVALID'
      | 'SHIPMENT_OPERATION_CONFLICT'
      | 'SHIPMENT_OPERATION_CLAIM_INCOMPLETE'
      | 'TRACKING_SOURCE_MISMATCH'
      | 'TRACKING_TRANSITION_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'ShipmentOperationDecisionError';
  }
}

/** Pure fail-closed boundary. The persistence owner must commit the claim,
 * shipment/provider evidence and outbox intent in one transaction. */
export function decideShipmentOperation(input: {
  command: ShipmentOperationCommand;
  existingClaim: PersistedShipmentOperationClaim | null;
}): ShipmentOperationDecision {
  const canonicalCommand = canonicalize(input.command);
  const operationHash = createHash('sha256').update(stableJson(canonicalCommand)).digest('hex');
  if (input.existingClaim !== null) {
    assertCompleteClaim(input.existingClaim);
    if (input.existingClaim.operationHash !== operationHash) {
      throw new ShipmentOperationDecisionError(
        'SHIPMENT_OPERATION_CONFLICT',
        'The idempotency key is already bound to another shipment operation.',
      );
    }
    return Object.freeze({ action: 'NOOP_REPLAY', operationHash, canonicalCommand });
  }
  return Object.freeze({ action: 'APPLY', operationHash, canonicalCommand });
}

/** Accepts only events already verified and normalized by the selected adapter.
 * Older duplicate facts are retained as evidence but cannot regress projection state. */
export function decideTrackingProjection(input: {
  expected: TrackingContext;
  callbackProvider: ShipmentProviderCode;
  fact: TrackingFact;
}): Readonly<{ action: 'APPLY' | 'IGNORE_STALE'; nextStatus: ShipmentStatus }> {
  const { expected, callbackProvider, fact } = input;
  if (!required(expected.shipmentId) || !required(expected.providerShipmentRef)
    || callbackProvider !== expected.provider || fact.shipmentId !== expected.shipmentId
    || fact.providerShipmentRef !== expected.providerShipmentRef) {
    throw new ShipmentOperationDecisionError('TRACKING_SOURCE_MISMATCH', 'Tracking callback does not belong to this shipment/provider binding.');
  }
  const currentTime = Date.parse(expected.currentEventTime);
  const eventTime = Date.parse(fact.eventTime);
  if (!Number.isFinite(currentTime) || !Number.isFinite(eventTime) || !required(fact.eventIdentity) || !required(fact.rawStatusCode)) {
    throw new ShipmentOperationDecisionError('SHIPMENT_OPERATION_CONTEXT_INVALID', 'Tracking context is incomplete or invalid.');
  }
  if (eventTime <= currentTime) return Object.freeze({ action: 'IGNORE_STALE', nextStatus: expected.currentStatus });
  if (!allowedNext(expected.currentStatus).includes(fact.status)) {
    throw new ShipmentOperationDecisionError('TRACKING_TRANSITION_INVALID', 'Tracking event would regress or violate the shipment state machine.');
  }
  return Object.freeze({ action: 'APPLY', nextStatus: fact.status });
}

function canonicalize(command: ShipmentOperationCommand): ShipmentOperationDecision['canonicalCommand'] {
  return Object.freeze({
    schemaVersion: 1 as const,
    shipmentId: required(command.shipmentId),
    fulfillmentId: required(command.fulfillmentId),
    provider: command.provider,
    connectionVersionId: required(command.connectionVersionId),
    operationId: required(command.operationId),
    idempotencyKey: required(command.idempotencyKey),
    parcelSnapshotRef: required(command.parcelSnapshotRef),
    qcEvidenceRef: required(command.qcEvidenceRef),
  });
}

function assertCompleteClaim(claim: PersistedShipmentOperationClaim): void {
  if (!claim || [claim.operationHash, claim.shipmentEvidenceRef, claim.providerEvidenceRef, claim.outboxIntentRef]
    .some(value => typeof value !== 'string' || !value.trim())) {
    throw new ShipmentOperationDecisionError(
      'SHIPMENT_OPERATION_CLAIM_INCOMPLETE',
      'Persisted shipment operation claim is missing shipment, provider or outbox evidence.',
    );
  }
}

function allowedNext(status: ShipmentStatus): readonly ShipmentStatus[] {
  const transitions: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
    READY: ['LABEL_CREATED', 'CANCELLED'],
    LABEL_CREATED: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['IN_TRANSIT'],
    IN_TRANSIT: ['DELIVERED', 'DELIVERY_FAILED', 'RETURNING'],
    DELIVERY_FAILED: ['IN_TRANSIT', 'RETURNING'],
    RETURNING: ['RETURNED'],
    DELIVERED: [], RETURNED: [], CANCELLED: [],
  };
  return transitions[status] ?? [];
}

function required(value: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ShipmentOperationDecisionError('SHIPMENT_OPERATION_CONTEXT_INVALID', 'Shipment operation context is incomplete or invalid.');
  }
  return normalized;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
