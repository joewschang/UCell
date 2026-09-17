export type PaymentProvider =
  | 'TAISHIN_ECOM'
  | 'TAISHIN_POS'
  | 'ECPAY'
  | 'LINE_PAY'
  | 'OTHER';

export type CanonicalPaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface CreatePaymentRequest {
  paymentId: string;
  orderId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  returnUrl?: string;
}

export interface ProviderPaymentResult {
  provider: PaymentProvider;
  providerTransactionRef: string;
  status: CanonicalPaymentStatus;
  safeResponseRef?: string;
}

export interface ProviderWebhookEnvelope {
  providerEventId?: string;
  rawBody: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  receivedAt: Date;
  correlationId: string;
}

export interface VerifiedProviderEvent {
  provider: PaymentProvider;
  providerEventIdentity: string;
  providerTransactionRef: string;
  status: CanonicalPaymentStatus;
  payloadHash: string;
  occurredAt?: string;
}

export const PAYMENT_PROVIDERS: readonly PaymentProvider[] = Object.freeze(['TAISHIN_ECOM', 'TAISHIN_POS', 'ECPAY', 'LINE_PAY', 'OTHER']);
export const PAYMENT_STATUSES: readonly CanonicalPaymentStatus[] = Object.freeze([
  'CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'PAID', 'FAILED', 'CANCELLED',
  'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED',
]);
export type VerifiedPaymentSource = 'VERIFIED_WEBHOOK' | 'PROVIDER_QUERY' | 'RECONCILIATION';
export const VERIFIED_PAYMENT_SOURCES: readonly VerifiedPaymentSource[] = Object.freeze(['VERIFIED_WEBHOOK', 'PROVIDER_QUERY', 'RECONCILIATION']);

/** Provider-specific operation identity is supplied only by a configured verifier.
 * Never infer it from amount/status, or use an evidence hash as a business effect key. */
export type VerifiedPaymentFact = Readonly<{
  provider: PaymentProvider; connectionId: string; paymentId: string; orderId: string;
  providerTransactionRef: string; operationId: string; operationKind: 'PAYMENT' | 'REFUND';
  amount: string; currency: string; status: CanonicalPaymentStatus; source: VerifiedPaymentSource;
  providerEventIdentity: string; payloadHash: string; safeEvidenceRef: string;
  verifiedAt: string; verificationConfigVersion: string;
}>;
declare const receiptBrand: unique symbol;
export type VerifiedPaymentReceipt = VerifiedPaymentFact & { readonly [receiptBrand]: true };
const issuedReceipts = new WeakSet<object>();

export class PaymentReceiptError extends Error {
  readonly code = 'PAYMENT_RECEIPT_UNTRUSTED';
  constructor() { super('A bound receipt from the configured verification boundary is required.'); }
}

export function assertIssuedPaymentReceipt(value: unknown): asserts value is VerifiedPaymentReceipt {
  if (typeof value !== 'object' || value === null || !issuedReceipts.has(value)) throw new PaymentReceiptError();
}

/** Composition-root capability, never an HTTP DTO factory. The injected verifier must
 * perform official signature/query/reconciliation verification and order/amount binding.
 * B1 installs no verifier or provider. Tests use explicit mock verifiers only.
 * Receipts cannot be JSON-deserialized as trusted; rehydration needs a Core-owned bridge. */
export function createPaymentVerificationBoundary<Input>(verifier: {
  verify(input: Input): Promise<VerifiedPaymentFact>;
}): (input: Input) => Promise<VerifiedPaymentReceipt> {
  return async input => {
    const fact = await verifier.verify(input);
    const fields = ['provider', 'connectionId', 'paymentId', 'orderId', 'providerTransactionRef',
      'operationId', 'operationKind', 'amount', 'currency', 'status', 'source', 'providerEventIdentity',
      'payloadHash', 'safeEvidenceRef', 'verifiedAt', 'verificationConfigVersion'] as const;
    if (!fact || fields.some(key => typeof fact[key] !== 'string' || !fact[key].trim() || fact[key] !== fact[key].trim())
      || !PAYMENT_PROVIDERS.includes(fact.provider) || !PAYMENT_STATUSES.includes(fact.status)
      || !VERIFIED_PAYMENT_SOURCES.includes(fact.source)
      || !['PAYMENT', 'REFUND'].includes(fact.operationKind)
      || !/^\d+(?:\.\d+)?$/.test(fact.amount) || !/^[A-Z]{3}$/.test(fact.currency)
      || !/^[a-f0-9]{64}$/.test(fact.payloadHash) || !Number.isFinite(Date.parse(fact.verifiedAt))) throw new PaymentReceiptError();
    const receipt = Object.freeze(Object.fromEntries(fields.map(key => [key, fact[key]]))) as VerifiedPaymentReceipt;
    issuedReceipts.add(receipt);
    return receipt;
  };
}

export interface ReconciliationQuery {
  settlementDate: string;
  providerBatchRef?: string;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createPayment(request: CreatePaymentRequest): Promise<ProviderPaymentResult>;
  queryPayment(providerTransactionRef: string): Promise<ProviderPaymentResult>;
  cancelOrVoid(providerTransactionRef: string, idempotencyKey: string): Promise<ProviderPaymentResult>;
  refund(
    providerTransactionRef: string,
    amount: string,
    idempotencyKey: string,
  ): Promise<ProviderPaymentResult>;
  verifyWebhook(envelope: ProviderWebhookEnvelope): Promise<VerifiedProviderEvent>;
  reconcile(query: ReconciliationQuery): Promise<ReadonlyArray<ProviderPaymentResult>>;
}
