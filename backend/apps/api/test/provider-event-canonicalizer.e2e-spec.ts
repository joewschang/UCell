import { PaymentEvidenceSecurityError } from '../src/modules/payment-hub/payment-evidence-sanitizer';
import {
  canonicalizeProviderEvent,
  ProviderEventCanonicalizationError,
} from '../src/modules/payment-hub/provider-event-canonicalizer';

const base = {
  provider: 'TAISHIN_ECOM' as const,
  source: 'VERIFIED_WEBHOOK' as const,
  providerTransactionRef: 'txn-001',
  status: 'PAID' as const,
  metadata: { amount: '4800.00', currency: 'TWD' },
};

describe('Payment provider event canonicalization', () => {
  it.each([
    { source: 'BROWSER_RETURN' }, { source: 'CONTROLLED_POS_EVIDENCE' },
    { provider: 'UNCONFIGURED' }, { status: 'UNRECOGNIZED' },
  ])('rejects untrusted runtime enum input %j', invalid => {
    expect(() => canonicalizeProviderEvent({ ...base, ...invalid } as never)).toThrow();
  });
  it('returns immutable evidence with timestamp independent of caller Date', () => {
    const date = new Date(0);
    const event = canonicalizeProviderEvent({ ...base, occurredAt: date });
    date.setTime(1000);
    expect(event.occurredAt).toBe('1970-01-01T00:00:00.000Z');
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.safeMetadata)).toBe(true);
  });
  it('rejects non-finite metadata before hashing', () => {
    expect(() => canonicalizeProviderEvent({ ...base, metadata: { result: NaN } })).toThrow();
  });
  it('uses a provider-namespaced explicit event identity', () => {
    const event = canonicalizeProviderEvent({ ...base, providerEventId: ' event-001 ' });
    expect(event.providerEventIdentity).toBe('TAISHIN_ECOM:EVENT:event-001');
    expect(event.providerTransactionRef).toBe('txn-001');
    expect(event.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('derives deterministic fallback identity regardless of metadata key order', () => {
    const first = canonicalizeProviderEvent({ ...base, metadata: { amount: '4800.00', currency: 'TWD' } });
    const second = canonicalizeProviderEvent({ ...base, metadata: { currency: 'TWD', amount: '4800.00' } });
    expect(second.providerEventIdentity).toBe(first.providerEventIdentity);
    expect(second.payloadHash).toBe(first.payloadHash);
  });

  it('ignores raw secret differences after redaction', () => {
    const first = canonicalizeProviderEvent({ ...base, metadata: { amount: '4800.00', signature: 'secret-a' } });
    const second = canonicalizeProviderEvent({ ...base, metadata: { amount: '4800.00', signature: 'secret-b' } });
    expect(second.payloadHash).toBe(first.payloadHash);
    expect(second.safeMetadata.signature).toBe('[REDACTED]');
  });

  it('changes payload hash when safe business evidence changes', () => {
    const paid = canonicalizeProviderEvent(base);
    const refunded = canonicalizeProviderEvent({ ...base, status: 'REFUNDED' });
    expect(refunded.payloadHash).not.toBe(paid.payloadHash);
    expect(refunded.providerEventIdentity).not.toBe(paid.providerEventIdentity);
  });

  it('namespaces fallback identities by provider', () => {
    const taishin = canonicalizeProviderEvent(base);
    const ecpay = canonicalizeProviderEvent({ ...base, provider: 'ECPAY' });
    expect(ecpay.providerEventIdentity).not.toBe(taishin.providerEventIdentity);
  });

  it('rejects missing transaction reference and blank supplied event ID', () => {
    expect(() => canonicalizeProviderEvent({ ...base, providerTransactionRef: ' ' })).toThrow(
      expect.objectContaining({ code: 'PROVIDER_TRANSACTION_REF_REQUIRED' }),
    );
    expect(() => canonicalizeProviderEvent({ ...base, providerEventId: ' ' })).toThrow(
      expect.objectContaining({ code: 'PROVIDER_EVENT_ID_INVALID' }),
    );
  });

  it('applies cardholder-data protection before hashing', () => {
    expect(() => canonicalizeProviderEvent({ ...base, metadata: { cvv: '123' } })).toThrow(
      expect.objectContaining({ code: 'CARDHOLDER_DATA_FORBIDDEN' }),
    );
  });

  it('exposes stable error classes', () => {
    expect(() => canonicalizeProviderEvent({ ...base, providerTransactionRef: '' })).toThrow(
      ProviderEventCanonicalizationError,
    );
    expect(() => canonicalizeProviderEvent({ ...base, metadata: { pan: 'x' } })).toThrow(
      PaymentEvidenceSecurityError,
    );
  });
});
