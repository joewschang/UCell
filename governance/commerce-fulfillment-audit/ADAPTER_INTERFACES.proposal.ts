/** PROPOSAL ONLY. No runtime wiring, provider implementation, or monetary formulas.
 * Freeze with Core + Schema Owner before splitting into B1 contract files.
 * Branded types are compiler boundaries, NOT runtime signature verification.
 * Closing delta df2547d adds payment-hub: extend that contract after ownership handoff,
 * do NOT install this proposal as a second canonical PaymentProviderAdapter.
 */
export type Id = string;
export type Timestamp = string;
export type Money = Readonly<{ amount: string; currency: string }>;
export type CommandContext = Readonly<{
  commandId: Id; idempotencyKey: string; correlationId: Id;
  actorRef: string; configVersion: string; requestedAt: Timestamp;
}>;
export type SafeEvidenceRef = Readonly<{
  evidenceId: Id; digest: string; schemaVersion: number;
  privateObjectRef?: string; // Sanitized allowlisted evidence, never secret/card data.
}>;
export type ProviderFailure = Readonly<{
  kind: 'FAILURE'; code: string;
  retryDisposition: 'RETRY_SAME_KEY' | 'RECONCILE_BEFORE_RETRY' | 'MANUAL_REVIEW' | 'PERMANENT';
  evidence?: SafeEvidenceRef;
}>;
export type ProviderResult<T> = Readonly<{ kind: 'SUCCESS'; value: T }> | ProviderFailure;
export type ProviderContext = Readonly<{
  connectionId: Id; environment: 'SANDBOX' | 'PRODUCTION';
  configVersion: string; secretReference: string;
}>;
// Raw bytes exist transiently ONLY at ingress/verifier; not in DB, log, domain event.
export type UntrustedWebhook = Readonly<{
  rawBody: Uint8Array; headers: Readonly<Record<string, string>>; receivedAt: Timestamp;
}>;
declare const verified: unique symbol;
export type Verified<T> = Readonly<{
  [verified]: true; fact: T; evidence: SafeEvidenceRef; verifiedAt: Timestamp;
  connectionId: Id; verificationConfigVersion: string;
}>;
export type Verification<T> = Readonly<{ kind: 'VERIFIED'; value: Verified<T> }>
  | Readonly<{ kind: 'REJECTED'; code: string }>;
export type EventEnvelope<T> = Readonly<{
  eventId: Id; schemaVersion: number; occurredAt: Timestamp;
  aggregateType: string; aggregateId: Id; correlationId: Id;
  source: string; actorRef: string; payload: T;
}>;

// Approved provider CAPTURED is normalized to PAID; AUTHORIZE alone is never PAID.
export type PaymentStatus = 'CREATED' | 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED'
  | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type PaymentProviderCode = 'TAISHIN_ECOM' | 'TAISHIN_POS' | 'ECPAY' | 'LINE_PAY' | 'OTHER';
export type PaymentFact = Readonly<{
  paymentId: Id; orderId: Id; providerTransactionRef: string; eventIdentity: string;
  status: PaymentStatus; consideration: Money; occurredAt: Timestamp;
  source: 'WEBHOOK' | 'QUERY' | 'RECONCILIATION';
  rawStatusCode: string;
}>;
export type RefundResult = Readonly<{
  refundId: Id; providerRefundRef: string; amount: Money;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED'; evidence: SafeEvidenceRef;
}>;
export type ReconciliationResult = Readonly<{
  reconciliationId: Id; status: 'MATCHED' | 'MISMATCH' | 'INCOMPLETE';
  facts: readonly Verified<PaymentFact>[]; differenceEvidence: SafeEvidenceRef;
  nextCursor?: string;
}>;
export interface PaymentProviderAdapter {
  readonly provider: PaymentProviderCode;
  createPayment(input: Readonly<{ paymentId: Id; orderId: Id; amount: Money;
    returnRouteRef: string }>, context: CommandContext): Promise<ProviderResult<Readonly<{
      paymentId: Id; status: 'CREATED' | 'PENDING'; redirectUrl?: string;
      providerRequestRef: string; evidence: SafeEvidenceRef;
    }>>>;
  queryPayment(input: Readonly<{ paymentId: Id; providerTransactionRef: string }>,
    context: CommandContext): Promise<ProviderResult<Verified<PaymentFact>>>;
  cancelOrVoid(input: Readonly<{ paymentId: Id; providerTransactionRef: string; reasonCode: string }>,
    context: CommandContext): Promise<ProviderResult<Verified<PaymentFact>>>;
  refund(input: Readonly<{ paymentId: Id; refundId: Id; providerTransactionRef: string;
    approvedAmount: Money; approvalEvidenceId: Id; rmaPostingRef?: Id }>,
    context: CommandContext): Promise<ProviderResult<RefundResult>>;
  verifyWebhook(input: UntrustedWebhook, context: ProviderContext): Promise<Verification<PaymentFact>>;
  reconcile(input: Readonly<{ settlementDate: string; providerBatchRef?: string; cursor?: string }>,
    context: CommandContext): Promise<ProviderResult<ReconciliationResult>>;
}
export interface OptionalCaptureCapability {
  capture(input: Readonly<{ paymentId: Id; authorizationRef: string; amount: Money }>,
    context: CommandContext): Promise<ProviderResult<Verified<PaymentFact>>>;
}
// POS is evidence intake, not a fabricated online createPayment implementation.
export interface PosEvidencePort {
  record(input: Readonly<{ orderId: Id; terminalRef?: string; batchRef?: string;
    transactionRef: string; amount: Money; occurredAt: Timestamp }>,
    context: CommandContext): Promise<Readonly<{ evidenceId: Id; status: 'PENDING_RECONCILIATION' }>>;
  verifyReconciliation(input: Readonly<{ evidenceId: Id; batchEvidenceRef: Id; policyVersion: string }>,
    context: CommandContext): Promise<ProviderResult<Verified<PaymentFact>>>;
}

export type TrackingMode = 'NONE' | 'LOT' | 'SERIAL' | 'LOT_SERIAL';
export type FulfillmentStatus = 'READY' | 'ALLOCATED' | 'PICKING' | 'PICKED' | 'QC_PENDING'
  | 'QC_PASSED' | 'PACKED' | 'SHIPPING_REQUESTED' | 'SHIPPED' | 'DELIVERED' | 'EXCEPTION' | 'CANCELLED';
export type QcStatus = 'PENDING' | 'PASS' | 'FAIL' | 'HOLD';
export type QcCheck = 'SKU' | 'QTY' | 'LOT_SERIAL' | 'EXPIRY' | 'PACKAGE_INTEGRITY' | 'LABEL';
export interface InventoryPort {
  reserve(input: Readonly<{ orderId: Id; paidEvidenceId: Id; warehouseId: Id;
    lines: readonly Readonly<{ orderLineId: Id; itemId: Id; quantity: string }>[];
    policyVersion: string }>, context: CommandContext): Promise<Readonly<{
      reservationId: Id; status: 'RESERVED'; movementIds: readonly Id[];
    }>>;
  release(input: Readonly<{ reservationId: Id; reasonCode: string }>, context: CommandContext): Promise<void>;
  returnPosted(input: Readonly<{ rmaId: Id; returnCaseId: Id; postingEvidenceId: Id }>,
    context: CommandContext): Promise<Readonly<{ movementIds: readonly Id[] }>>;
}

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

export type InvoiceStatus = 'REQUESTED' | 'ISSUED' | 'VOIDED' | 'ALLOWANCE_PENDING' | 'ALLOWANCE_ISSUED' | 'FAILED';
export type InvoiceFact = Readonly<{
  invoiceId: Id; providerRef: string; eventIdentity: string; status: InvoiceStatus;
  invoiceNumber?: string; occurredAt: Timestamp; rawStatusCode: string;
}>;
export interface InvoiceProviderAdapter {
  readonly provider: 'ECPAY' | 'OTHER';
  issueInvoice(input: Readonly<{ invoiceId: Id; orderId: Id; buyerSnapshotRef: Id;
    taxSnapshotRef: Id; policyVersion: string }>, context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  voidInvoice(input: Readonly<{ invoiceId: Id; providerRef: string; reasonCode: string; approvalEvidenceId: Id }>,
    context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  issueAllowance(input: Readonly<{ invoiceId: Id; allowanceId: Id; providerRef: string;
    approvedAmount: Money; postingEvidenceId: Id; approvalEvidenceId: Id }>,
    context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  queryInvoice(input: Readonly<{ invoiceId: Id; providerRef: string }>,
    context: CommandContext): Promise<ProviderResult<Verified<InvoiceFact>>>;
  verifyCallback(input: UntrustedWebhook, context: ProviderContext): Promise<Verification<InvoiceFact>>;
}

export type RmaStatus = 'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'POSTED' | 'REFUNDED' | 'CLOSED' | 'REJECTED';
export type ReturnDisposition = 'RESTOCK' | 'QUARANTINE' | 'DISCARD';
export type ErpDomain = 'ITEM' | 'INVENTORY' | 'ORDER' | 'SHIPMENT' | 'INVOICE' | 'ACCOUNTING';
export type ErpSyncRequest = Readonly<{
  outboxId: Id; entityId: Id; entityType: string; payloadVersion: number;
  immutableSnapshotRef: Id; externalMappingRef?: Id; connectionVersion: string;
}>;
export type ErpSyncReceipt = Readonly<{
  externalId: string; externalVersion?: string; evidence: SafeEvidenceRef;
}>;
export interface ErpAdapter {
  readonly provider: 'DYNAMICS_365_BC';
  syncItem(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncCustomerReference(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncOrder(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncShipment(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  syncInvoice(input: ErpSyncRequest, context: CommandContext): Promise<ProviderResult<ErpSyncReceipt>>;
  reconcile(input: Readonly<{ domain: ErpDomain; sourceWatermark: string; cursor?: string }>,
    context: CommandContext): Promise<ProviderResult<Readonly<{
      status: 'MATCHED' | 'MISMATCH' | 'INCOMPLETE'; evidence: SafeEvidenceRef; nextCursor?: string;
    }>>>;
}
export type ErpMode = Readonly<{ provider: 'NONE'; inventoryAuthority: 'UCELL'; adapter?: never }>
  | Readonly<{ provider: 'DYNAMICS_365_BC'; adapter: ErpAdapter; connectionVersion: string;
      approvedDomainAuthorities: Readonly<Partial<Record<ErpDomain, 'UCELL' | 'BC'>>> }>;

/** Core-owned seam. Commerce must not implement monetary recognition or return allocation.
 * Core owner must supply a transactional/idempotent bridge before runtime use.
 */
export interface CoreCommerceEvidencePort {
  acceptVerifiedPayment(input: Verified<PaymentFact>, context: CommandContext): Promise<Readonly<{
    paymentEventId: Id; orderId: Id; coreReceiptRef: Id;
    recognitionStatus: 'ACCEPTED_FOR_CORE_PROCESSING' | 'CONFIGURATION_PENDING';
  }>>;
  postApprovedRma(input: Readonly<{ rmaId: Id; orderId: Id; receiptEvidenceId: Id;
    approvedAllocationRef: Id; lines: readonly Readonly<{ orderLineId: Id; quantity: string }>[] }>,
    context: CommandContext): Promise<Readonly<{ returnCaseId: Id; status: 'POSTED'; postingEvidenceId: Id }>>;
}
