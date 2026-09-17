import { PaymentTransitionError } from '../src/modules/payment-hub/canonical-payment-transition';
import {
  decideProviderEventApplication,
  ProviderEventDecisionError,
} from '../src/modules/payment-hub/provider-event-decision';

const event = {
  provider: 'TAISHIN_ECOM' as const,
  source: 'VERIFIED_WEBHOOK' as const,
  providerEventId: 'event-001',
  providerTransactionRef: 'txn-001',
  status: 'PAID' as const,
  metadata: { amount: '4800.00', currency: 'TWD' },
};
const verified = { signatureVerified: true };

describe('Payment provider event application decision', () => {
  it('applies a new verified event and returns its canonical status', () => {
    const decision = decideProviderEventApplication({
      currentStatus: 'PENDING', existingPayloadHash: null, event, evidence: verified,
    });
    expect(decision).toMatchObject({ action: 'APPLY', nextStatus: 'PAID' });
    expect(decision.event.providerEventIdentity).toBe('TAISHIN_ECOM:EVENT:event-001');
  });

  it('returns NOOP for an exact replay even after status was already applied', () => {
    const first = decideProviderEventApplication({
      currentStatus: 'PENDING', existingPayloadHash: null, event, evidence: verified,
    });
    const replay = decideProviderEventApplication({
      currentStatus: 'PAID', existingPayloadHash: first.event.payloadHash, event, evidence: {},
    });
    expect(replay).toMatchObject({ action: 'NOOP_REPLAY', nextStatus: 'PAID' });
  });

  it('rejects an existing identity whose canonical payload changed', () => {
    const first = decideProviderEventApplication({
      currentStatus: 'PENDING', existingPayloadHash: null, event, evidence: verified,
    });
    expect(() => decideProviderEventApplication({
      currentStatus: 'PAID',
      existingPayloadHash: first.event.payloadHash,
      event: { ...event, metadata: { amount: '4900.00', currency: 'TWD' } },
      evidence: verified,
    })).toThrow(expect.objectContaining({ code: 'PROVIDER_EVENT_IDENTITY_CONFLICT' }));
  });

  it('requires trusted evidence for a new event even when status is unchanged', () => {
    expect(() => decideProviderEventApplication({
      currentStatus: 'PAID', existingPayloadHash: null, event, evidence: {},
    })).toThrow(expect.objectContaining({ code: 'PAYMENT_EVIDENCE_INCOMPLETE' }));
  });

  it('rejects evidence source mismatch before applying a transition', () => {
    expect(() => decideProviderEventApplication({
      currentStatus: 'PENDING',
      existingPayloadHash: null,
      event,
      evidence: { source: 'PROVIDER_QUERY', signatureVerified: true },
    })).toThrow(expect.objectContaining({ code: 'PAYMENT_EVIDENCE_SOURCE_MISMATCH' }));
  });

  it('still rejects invalid status regression for a new event', () => {
    expect(() => decideProviderEventApplication({
      currentStatus: 'REFUNDED', existingPayloadHash: null, event, evidence: verified,
    })).toThrow(expect.objectContaining({ code: 'PAYMENT_TRANSITION_INVALID' }));
  });

  it('exposes stable decision and transition error classes', () => {
    expect(() => decideProviderEventApplication({
      currentStatus: 'PENDING', existingPayloadHash: 'different-hash', event, evidence: verified,
    })).toThrow(ProviderEventDecisionError);
    expect(() => decideProviderEventApplication({
      currentStatus: 'PENDING', existingPayloadHash: null, event, evidence: {},
    })).toThrow(PaymentTransitionError);
  });
});
