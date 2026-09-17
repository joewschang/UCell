import { PaymentProvider, PaymentProviderAdapter, PAYMENT_PROVIDERS } from './payment-provider.adapter';

export type PaymentProviderAvailability = 'ENABLED' | 'CONFIG_PENDING' | 'FEATURE_DISABLED';

export class PaymentProviderRegistryError extends Error {
  constructor(
    readonly code:
      | 'PAYMENT_PROVIDER_DUPLICATE'
      | 'PAYMENT_PROVIDER_DISABLED'
      | 'PAYMENT_PROVIDER_CONFIG_PENDING'
      | 'PAYMENT_PROVIDER_ADAPTER_UNAVAILABLE'
      | 'PAYMENT_PROVIDER_CONFIG_INVALID',
    message: string,
    readonly provider: PaymentProvider,
  ) {
    super(message);
    this.name = 'PaymentProviderRegistryError';
  }
}

export class PaymentProviderRegistry {
  private readonly adapters = new Map<PaymentProvider, PaymentProviderAdapter>();

  constructor(
    adapters: ReadonlyArray<PaymentProviderAdapter>,
    private readonly availability: Readonly<Partial<Record<PaymentProvider, PaymentProviderAvailability>>>,
  ) {
    this.availability = Object.freeze({ ...availability });
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.provider)) {
        throw new PaymentProviderRegistryError(
          'PAYMENT_PROVIDER_DUPLICATE',
          `Multiple adapters are registered for ${adapter.provider}.`,
          adapter.provider,
        );
      }
      this.adapters.set(adapter.provider, adapter);
    }
  }

  status(provider: PaymentProvider): PaymentProviderAvailability {
    return this.availability[provider] ?? 'FEATURE_DISABLED';
  }

  resolve(provider: PaymentProvider): PaymentProviderAdapter {
    if (!PAYMENT_PROVIDERS.includes(provider)) throw new PaymentProviderRegistryError('PAYMENT_PROVIDER_CONFIG_INVALID', 'Unknown payment provider.', provider);
    const status = this.status(provider);
    if (status === 'FEATURE_DISABLED') {
      throw new PaymentProviderRegistryError(
        'PAYMENT_PROVIDER_DISABLED',
        `Payment provider ${provider} is feature disabled.`,
        provider,
      );
    }
    if (status === 'CONFIG_PENDING') {
      throw new PaymentProviderRegistryError(
        'PAYMENT_PROVIDER_CONFIG_PENDING',
        `Payment provider ${provider} is awaiting approved environment configuration.`,
        provider,
      );
    }
    if (status !== 'ENABLED') throw new PaymentProviderRegistryError('PAYMENT_PROVIDER_CONFIG_INVALID', 'Unknown provider availability.', provider);
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new PaymentProviderRegistryError(
        'PAYMENT_PROVIDER_ADAPTER_UNAVAILABLE',
        `Payment provider ${provider} is enabled but no adapter is registered.`,
        provider,
      );
    }
    return adapter;
  }
}
