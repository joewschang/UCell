import type { Id, Timestamp, Money, CommandContext, SafeEvidenceRef, ProviderResult, ProviderContext, UntrustedWebhook, Verified, Verification } from './common';

export type ShippingMethod = 'HOME_DELIVERY' | 'CVS_PICKUP';
export type ShipmentStatus = 'READY' | 'LABEL_CREATED' | 'PICKED_UP' | 'IN_TRANSIT'
  | 'DELIVERED' | 'DELIVERY_FAILED' | 'RETURNING' | 'RETURNED' | 'CANCELLED';
export type ShipmentProviderCode = 'BLACK_CAT' | 'SEVEN_ELEVEN' | 'ECPAY_LOGISTICS' | 'OTHER';
export type TrackingFact = Readonly<{
  shipmentId: Id; providerShipmentRef: string; eventIdentity: string;
  status: ShipmentStatus; eventTime: Timestamp; rawStatusCode: string;
}>;
export type VerifiedTrackingSource = Readonly<{
  providerShipmentRef: string; eventIdentity: string; rawStatusCode: string;
  eventTime: Timestamp; safeEvidence: SafeEvidenceRef;
}>;
export interface LogisticsProviderAdapter {
  readonly provider: ShipmentProviderCode;
  createShipment(input: Readonly<{ shipmentId: Id; parcelId: Id;
    carrier: 'BLACK_CAT' | 'SEVEN_ELEVEN' | 'OTHER'; serviceType: ShippingMethod;
    recipientSnapshotRef: Id; pickupStoreSnapshotRef?: Id; qcEvidenceRef: Id }>,
    context: CommandContext): Promise<ProviderResult<Readonly<{
      providerShipmentRef: string; trackingNo?: string; status: 'READY' | 'LABEL_CREATED';
      evidence: SafeEvidenceRef;
    }>>>;
  getLabel(input: Readonly<{ shipmentId: Id; providerShipmentRef: string }>,
    context: CommandContext): Promise<ProviderResult<Readonly<{
      privateLabelRef: string; digest: string; expiresAt?: Timestamp;
    }>>>;
  cancelShipment(input: Readonly<{ shipmentId: Id; providerShipmentRef: string; reasonCode: string }>,
    context: CommandContext): Promise<ProviderResult<Verified<TrackingFact>>>;
  queryTracking(input: Readonly<{ shipmentId: Id; providerShipmentRef: string }>,
    context: CommandContext): Promise<ProviderResult<readonly Verified<TrackingFact>[]>>;
  verifyWebhook(input: UntrustedWebhook, context: ProviderContext): Promise<Verification<VerifiedTrackingSource>>;
  normalizeTrackingEvent(input: Verified<VerifiedTrackingSource>): ProviderResult<TrackingFact>;
}
export interface PickupStoreCapability {
  validateStore(input: Readonly<{ providerStoreRef: string; serviceType: 'CVS_PICKUP' }>,
    context: CommandContext): Promise<ProviderResult<Readonly<{ immutableStoreSnapshotRef: Id }>>>;
}
