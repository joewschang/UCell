import { PaymentProviderAdapter } from '../src/modules/payment-hub/payment-provider.adapter';
import {
  PaymentProviderRegistry,
  PaymentProviderRegistryError,
} from '../src/modules/payment-hub/payment-provider.registry';

function adapter(provider: PaymentProviderAdapter['provider']): PaymentProviderAdapter {
  return {
    provider,
    createPayment: jest.fn(),
    queryPayment: jest.fn(),
    cancelOrVoid: jest.fn(),
    refund: jest.fn(),
    verifyWebhook: jest.fn(),
    reconcile: jest.fn(),
  };
}

describe('Payment provider registry', () => {
  it('rejects unknown runtime availability and snapshots mutable config', () => {
    const taishin = adapter('TAISHIN_ECOM');
    expect(() => new PaymentProviderRegistry([taishin], JSON.parse('{"TAISHIN_ECOM":"ENABELD"}')).resolve('TAISHIN_ECOM')).toThrow();
    const config = { TAISHIN_ECOM: 'FEATURE_DISABLED' as const };
    const registry = new PaymentProviderRegistry([taishin], config);
    Object.assign(config, { TAISHIN_ECOM: 'ENABLED' });
    expect(() => registry.resolve('TAISHIN_ECOM')).toThrow();
    expect(() => new PaymentProviderRegistry([adapter('UNKNOWN' as never)], { UNKNOWN: 'ENABLED' } as never).resolve('UNKNOWN' as never)).toThrow();
  });
  it('resolves one explicitly enabled provider adapter', () => {
    const taishin = adapter('TAISHIN_ECOM');
    const registry = new PaymentProviderRegistry([taishin], { TAISHIN_ECOM: 'ENABLED' });
    expect(registry.resolve('TAISHIN_ECOM')).toBe(taishin);
  });

  it('defaults an unspecified provider to FEATURE_DISABLED', () => {
    const registry = new PaymentProviderRegistry([adapter('LINE_PAY')], {});
    expect(registry.status('LINE_PAY')).toBe('FEATURE_DISABLED');
    expect(() => registry.resolve('LINE_PAY')).toThrow(
      expect.objectContaining({ code: 'PAYMENT_PROVIDER_DISABLED', provider: 'LINE_PAY' }),
    );
  });

  it('fails closed while provider configuration is pending even when adapter code exists', () => {
    const registry = new PaymentProviderRegistry([adapter('ECPAY')], { ECPAY: 'CONFIG_PENDING' });
    expect(() => registry.resolve('ECPAY')).toThrow(
      expect.objectContaining({ code: 'PAYMENT_PROVIDER_CONFIG_PENDING', provider: 'ECPAY' }),
    );
  });

  it('fails closed when configuration enables a provider without an adapter', () => {
    const registry = new PaymentProviderRegistry([], { TAISHIN_POS: 'ENABLED' });
    expect(() => registry.resolve('TAISHIN_POS')).toThrow(
      expect.objectContaining({ code: 'PAYMENT_PROVIDER_ADAPTER_UNAVAILABLE', provider: 'TAISHIN_POS' }),
    );
  });

  it('rejects duplicate adapters so provider routing cannot be ambiguous', () => {
    expect(() => new PaymentProviderRegistry(
      [adapter('TAISHIN_ECOM'), adapter('TAISHIN_ECOM')],
      { TAISHIN_ECOM: 'ENABLED' },
    )).toThrow(expect.objectContaining({ code: 'PAYMENT_PROVIDER_DUPLICATE' }));
  });

  it('exposes stable machine-readable routing errors', () => {
    try {
      new PaymentProviderRegistry([], {}).resolve('OTHER');
      throw new Error('expected provider rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentProviderRegistryError);
      expect(error).toMatchObject({ code: 'PAYMENT_PROVIDER_DISABLED', provider: 'OTHER' });
    }
  });
});
