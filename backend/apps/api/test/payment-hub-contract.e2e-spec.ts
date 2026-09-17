import {
  assertCanonicalPaymentTransition,
  classifyProviderEvent,
  PaymentTransitionError,
} from '../src/modules/payment-hub/canonical-payment-transition';

describe('Payment Hub canonical contract', () => {
  const webhookEvidence = {
    source: 'VERIFIED_WEBHOOK' as const,
    signatureVerified: true,
    providerEventIdentity: 'event-001',
    providerTransactionRef: 'txn-001',
  };

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

  it('permits controlled POS evidence without storing card data', () => {
    expect(() =>
      assertCanonicalPaymentTransition('PENDING', 'PAID', {
        source: 'CONTROLLED_POS_EVIDENCE',
        providerTransactionRef: 'pos-txn-001',
        terminalRef: 'terminal-01',
        batchRef: 'batch-01',
        recordedBy: 'operator-01',
      }),
    ).not.toThrow();
  });

  it('classifies duplicate provider delivery without a second business effect', () => {
    expect(classifyProviderEvent(null, 'hash-a')).toEqual({ result: 'NEW' });
    expect(classifyProviderEvent('hash-a', 'hash-a')).toEqual({ result: 'REPLAY' });
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
