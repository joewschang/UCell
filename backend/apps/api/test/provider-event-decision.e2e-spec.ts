import { decideProviderEventApplication } from '../src/modules/payment-hub/provider-event-decision';
import { canonicalizeProviderEvent } from '../src/modules/payment-hub/provider-event-canonicalizer';
import { createPaymentVerificationBoundary, VerifiedPaymentFact, VerifiedPaymentReceipt } from '../src/modules/payment-hub/payment-provider.adapter';

const event = { provider: 'TAISHIN_ECOM' as const, source: 'VERIFIED_WEBHOOK' as const,
  providerEventId: 'event-test', providerTransactionRef: 'transaction-test', status: 'PAID' as const,
  metadata: { amount: '100.00', currency: 'TWD' } };
const binding = { paymentId: 'payment-test', orderId: 'order-test', provider: event.provider,
  connectionId: 'merchant-test', providerTransactionRef: event.providerTransactionRef, ...event.metadata };

// Explicit mock trust root. This never represents provider signature or UAT evidence.
async function fixture(inputEvent: Parameters<typeof canonicalizeProviderEvent>[0] = event, overrides: Partial<VerifiedPaymentFact> = {}) {
  const canonical = canonicalizeProviderEvent(inputEvent);
  const receipt = await createPaymentVerificationBoundary({ verify: async (): Promise<VerifiedPaymentFact> => ({
    ...binding, provider: inputEvent.provider, status: inputEvent.status,
    source: inputEvent.source as VerifiedPaymentFact['source'],
    operationKind: 'PAYMENT', operationId: 'capture-test', providerEventIdentity: canonical.providerEventIdentity,
    payloadHash: canonical.payloadHash, safeEvidenceRef: 'evidence-test', verifiedAt: '2026-09-17T00:00:00Z',
    verificationConfigVersion: 'MOCK_ONLY', ...overrides,
  }) })(undefined);
  return { currentStatus: 'PENDING' as const, binding, existingPayloadHash: null, existingOperationHash: null,
    event: inputEvent, evidence: { receipt } };
}
describe('Payment event and business-operation decisions (pure contract)', () => {
  it('applies a bound, mock-verified operation', async () => {
    expect(decideProviderEventApplication(await fixture())).toMatchObject({ action: 'APPLY', nextStatus: 'PAID' });
  });
  it('requires verification even for exact delivery replay', async () => {
    const input = await fixture(); const first = decideProviderEventApplication(input);
    const replay = { ...input, currentStatus: 'PAID' as const, existingPayloadHash: first.event.payloadHash, existingOperationHash: first.operationHash };
    expect(decideProviderEventApplication(replay).action).toBe('NOOP_REPLAY');
    expect(() => decideProviderEventApplication({ ...replay, evidence: { receipt: {} as VerifiedPaymentReceipt } })).toThrow();
    expect(() => decideProviderEventApplication({ ...replay, existingOperationHash: null })).toThrow();
    expect(() => decideProviderEventApplication({ ...replay, currentStatus: 'UNKNOWN' as never })).toThrow();
  });
  it('deduplicates one operation observed through webhook and query', async () => {
    const first = decideProviderEventApplication(await fixture());
    const query = await fixture({ ...event, source: 'PROVIDER_QUERY', providerEventId: 'query-observation' });
    const second = decideProviderEventApplication({ ...query, currentStatus: 'PAID', existingOperationHash: first.operationHash });
    expect(second.event.providerEventIdentity).not.toBe(first.event.providerEventIdentity);
    expect(second.businessEffectIdentity).toBe(first.businessEffectIdentity);
    expect(second.action).toBe('NOOP_OPERATION');
  });
  it.each(['orderId', 'paymentId', 'connectionId', 'amount', 'currency', 'provider', 'providerTransactionRef'] as const)(
    'rejects receipt binding mismatch on %s', async key => {
      const input = await fixture();
      expect(() => decideProviderEventApplication({ ...input, binding: { ...binding, [key]: 'mismatch' } })).toThrow(
        expect.objectContaining({ code: 'PAYMENT_RECEIPT_BINDING_MISMATCH' }));
    });
  it('rejects canonical payload tampering and conflicting operation evidence', async () => {
    const input = await fixture();
    expect(() => decideProviderEventApplication({ ...input, event: { ...event, metadata: { ...event.metadata, amount: '200.00' } } })).toThrow();
    expect(() => decideProviderEventApplication({ ...input, existingOperationHash: 'conflict' })).toThrow(
      expect.objectContaining({ code: 'PAYMENT_OPERATION_CONFLICT' }));
    expect(() => decideProviderEventApplication({ ...input, existingPayloadHash: 'conflict' })).toThrow(
      expect.objectContaining({ code: 'PROVIDER_EVENT_IDENTITY_CONFLICT' }));
  });
  it('keeps two partial refund operations distinct', async () => {
    const refundEvent = { ...event, status: 'PARTIALLY_REFUNDED' as const };
    const a = await fixture(refundEvent, { operationKind: 'REFUND', operationId: 'refund-a' });
    const b = await fixture({ ...refundEvent, providerEventId: 'refund-event-b' }, { operationKind: 'REFUND', operationId: 'refund-b' });
    const first = decideProviderEventApplication({ ...a, currentStatus: 'PAID' });
    const second = decideProviderEventApplication({ ...b, currentStatus: 'PARTIALLY_REFUNDED' });
    expect(second.businessEffectIdentity).not.toBe(first.businessEffectIdentity);
    expect(second.action).toBe('APPLY');
  });
  it('rejects source mismatch and terminal-state regression', async () => {
    const input = await fixture();
    expect(() => decideProviderEventApplication({ ...input, evidence: { ...input.evidence, source: 'PROVIDER_QUERY' } })).toThrow();
    expect(() => decideProviderEventApplication({ ...input, currentStatus: 'REFUNDED' })).toThrow();
  });
  it('requires verifier success and rejects unbound results', async () => {
    await expect(createPaymentVerificationBoundary({ verify: async (): Promise<VerifiedPaymentFact> => { throw new Error('mock verifier rejected'); } })(undefined)).rejects.toThrow();
    await expect(fixture(event, { operationId: '' })).rejects.toThrow();
  });
});
