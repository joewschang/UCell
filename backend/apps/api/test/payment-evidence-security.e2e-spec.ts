import {
  PaymentEvidenceSecurityError,
  sanitizePaymentEvidenceMetadata,
} from '../src/modules/payment-hub/payment-evidence-sanitizer';

describe('Payment Hub evidence security', () => {
  it('preserves safe provider references while redacting secrets recursively', () => {
    const source = {
      providerTransactionRef: 'txn-001',
      providerEventId: 'event-001',
      response: { status: 'PAID', signature: 'raw-signature', authorization: 'Bearer secret' },
    };

    expect(sanitizePaymentEvidenceMetadata(source)).toEqual({
      providerTransactionRef: 'txn-001',
      providerEventId: 'event-001',
      response: { status: 'PAID', signature: '[REDACTED]', authorization: '[REDACTED]' },
    });
    expect(source.response.signature).toBe('raw-signature');
  });

  it.each(['pan', 'card_number', 'CVV', 'track2', 'full-track-data'])(
    'rejects forbidden cardholder field %s',
    (field) => {
      expect(() => sanitizePaymentEvidenceMetadata({ [field]: 'sensitive' })).toThrow(
        expect.objectContaining({ code: 'CARDHOLDER_DATA_FORBIDDEN' }),
      );
    },
  );

  it('rejects a likely PAN hidden inside an otherwise generic string field', () => {
    expect(() => sanitizePaymentEvidenceMetadata({ note: 'card 4111 1111 1111 1111' })).toThrow(
      expect.objectContaining({ code: 'CARDHOLDER_DATA_FORBIDDEN' }),
    );
  });

  it('allows a numeric provider reference while keeping generic text under PAN detection', () => {
    expect(sanitizePaymentEvidenceMetadata({ providerTransactionRef: '4111111111111111' })).toEqual({
      providerTransactionRef: '4111111111111111',
    });
    expect(() => sanitizePaymentEvidenceMetadata({ description: '4111111111111111' })).toThrow(
      expect.objectContaining({ code: 'CARDHOLDER_DATA_FORBIDDEN' }),
    );
  });

  it('does not confuse ordinary provider, terminal or batch references with a PAN', () => {
    expect(sanitizePaymentEvidenceMetadata({
      providerTransactionRef: 'TXN-20260917-000001',
      terminalRef: 'TERM-01',
      batchRef: 'BATCH-20260917',
      amount: '4800.00',
    })).toEqual({
      providerTransactionRef: 'TXN-20260917-000001',
      terminalRef: 'TERM-01',
      batchRef: 'BATCH-20260917',
      amount: '4800.00',
    });
  });

  it('rejects values that cannot be represented as immutable JSON evidence', () => {
    expect(() => sanitizePaymentEvidenceMetadata({ receivedAt: new Date() })).toThrow(
      expect.objectContaining({ code: 'PAYMENT_EVIDENCE_UNSUPPORTED_VALUE' }),
    );
  });

  it('exposes stable machine-readable security errors', () => {
    try {
      sanitizePaymentEvidenceMetadata({ cvc2: '123' });
      throw new Error('expected security rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentEvidenceSecurityError);
      expect(error).toMatchObject({ code: 'CARDHOLDER_DATA_FORBIDDEN' });
    }
  });
});
