import {
  assertCanonicalPaymentTransition,
  classifyProviderEvent,
  PaymentTransitionError,
} from '../src/modules/payment-hub/canonical-payment-transition';
import { createPaymentVerificationBoundary, VerifiedPaymentReceipt } from '../src/modules/payment-hub/payment-provider.adapter';

describe('Payment Hub canonical contract', () => {
  const webhookEvidence = {
    receipt: undefined as VerifiedPaymentReceipt | undefined,
    source: 'VERIFIED_WEBHOOK' as const,
    signatureVerified: true,
    providerEventIdentity: 'event-001',
    providerTransactionRef: 'txn-001',
  };
  beforeAll(async () => {
    webhookEvidence.receipt = await createPaymentVerificationBoundary({ verify: async () => ({
      provider: 'TAISHIN_ECOM', connectionId: 'merchant-test', paymentId: 'payment-test', orderId: 'order-test',
      operationId: 'capture-test', operationKind: 'PAYMENT', amount: '100.00', currency: 'TWD',
      status: 'PAID', source: 'VERIFIED_WEBHOOK', providerEventIdentity: 'event-001', providerTransactionRef: 'txn-001',
      payloadHash: 'a'.repeat(64), safeEvidenceRef: 'evidence-test', verifiedAt: '2026-09-17T00:00:00Z', verificationConfigVersion: 'mock-only',
    }) })(undefined);
  });

  it('accepts PAID only from complete verified provider evidence', () => {
    expect(() => assertCanonicalPaymentTransition('PENDING', 'PAID', webhookEvidence)).not.toThrow();
  });

  it('fails closed when browser return attempts to mark a payment PAID', () => {
    expect(() =>
      assertCanonicalPaymentTransition('PENDING', 'PAID', { source: 'BROWSER_RETURN' }),
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_EVIDENCE_UNTRUSTED' }));
  });

  it('requires verified webhook identity and transaction evidence', () => {
    expect(() =>
      assertCanonicalPaymentTransition('PENDING', 'PAID', {
        source: 'VERIFIED_WEBHOOK',
        signatureVerified: true,
      }),
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_EVIDENCE_INCOMPLETE' }));
  });

  it('requires trusted evidence before entering the refund lifecycle', () => {
    expect(() =>
      assertCanonicalPaymentTransition('PAID', 'REFUND_PENDING', { source: 'BROWSER_RETURN' }),
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_EVIDENCE_UNTRUSTED' }));
  });

  it('prevents a paid payment from regressing to pending or failed', () => {
    for (const target of ['PENDING', 'FAILED'] as const) {
      expect(() => assertCanonicalPaymentTransition('PAID', target, webhookEvidence)).toThrow(
        expect.objectContaining({ code: 'PAYMENT_TRANSITION_INVALID' }),
      );
    }
  });

  it('requires verified reconciliation after controlled POS intake', () => {
    expect(() =>
      assertCanonicalPaymentTransition('PENDING', 'PAID', {
        source: 'CONTROLLED_POS_EVIDENCE',
        providerTransactionRef: 'pos-txn-001',
        terminalRef: 'terminal-01',
        batchRef: 'batch-01',
        recordedBy: 'operator-01',
      }),
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_EVIDENCE_UNTRUSTED' }));
  });

  it('classifies duplicate evidence without claiming DB effect idempotency', () => {
    expect(classifyProviderEvent(null, 'hash-a')).toEqual({ result: 'NEW' });
    expect(classifyProviderEvent('hash-a', 'hash-a')).toEqual({ result: 'REPLAY' });
  });

  it.each(['UNRECOGNIZED', '', 'browser_return'])('rejects runtime source %s', source => {
    expect(() => assertCanonicalPaymentTransition('PENDING', 'PAID', { ...webhookEvidence, source: source as never })).toThrow();
  });
  it('rejects query references alone and copied receipts', () => {
    expect(() => assertCanonicalPaymentTransition('PENDING', 'PAID', { source: 'PROVIDER_QUERY', providerTransactionRef: 'txn-001' })).toThrow();
    expect(() => assertCanonicalPaymentTransition('PENDING', 'PAID', { ...webhookEvidence, receipt: { ...webhookEvidence.receipt! } })).toThrow();
  });

  it('rejects reuse of provider event identity with a changed payload', () => {
    expect(classifyProviderEvent('hash-a', 'hash-b')).toEqual({
      result: 'CONFLICT',
      code: 'PROVIDER_EVENT_IDENTITY_CONFLICT',
    });
  });

  it('exposes stable machine-readable errors', () => {
    try {
      assertCanonicalPaymentTransition('REFUNDED', 'PAID', webhookEvidence);
      throw new Error('expected transition rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentTransitionError);
      expect(error).toMatchObject({ code: 'PAYMENT_TRANSITION_INVALID' });
    }
  });
});
