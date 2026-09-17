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
  occurredAt?: Date;
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
