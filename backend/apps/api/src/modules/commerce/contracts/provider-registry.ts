export type ProviderAvailability = 'ENABLED' | 'CONFIG_PENDING' | 'FEATURE_DISABLED';

export class ProviderRegistryError extends Error {
  constructor(
    readonly code: 'PROVIDER_DUPLICATE' | 'PROVIDER_DISABLED' | 'PROVIDER_CONFIG_PENDING'
      | 'PROVIDER_ADAPTER_UNAVAILABLE' | 'PROVIDER_CONFIG_INVALID',
    message: string,
    readonly provider: string,
  ) {
    super(message);
    this.name = 'ProviderRegistryError';
  }
}

/** Fail-closed routing shared by invoice and logistics adapters. Provider-specific
 * credentials remain outside the registry and are referenced by configuration version. */
export class ProviderRegistry<Code extends string, Adapter extends { readonly provider: Code }> {
  private readonly adapters = new Map<Code, Adapter>();
  private readonly availability: Readonly<Partial<Record<Code, ProviderAvailability>>>;

  constructor(
    adapters: readonly Adapter[],
    availability: Readonly<Partial<Record<Code, ProviderAvailability>>>,
    private readonly supportedProviders: readonly Code[],
  ) {
    this.availability = Object.freeze({ ...availability });
    for (const adapter of adapters) {
      if (!supportedProviders.includes(adapter.provider)) {
        throw new ProviderRegistryError('PROVIDER_CONFIG_INVALID', 'Unsupported provider adapter.', adapter.provider);
      }
      if (this.adapters.has(adapter.provider)) {
        throw new ProviderRegistryError('PROVIDER_DUPLICATE', 'Provider adapter is registered more than once.', adapter.provider);
      }
      this.adapters.set(adapter.provider, adapter);
    }
  }

  status(provider: Code): ProviderAvailability {
    return this.availability[provider] ?? 'FEATURE_DISABLED';
  }

  resolve(provider: Code): Adapter {
    if (!this.supportedProviders.includes(provider)) throw new ProviderRegistryError('PROVIDER_CONFIG_INVALID', 'Unsupported provider.', provider);
    const status = this.status(provider);
    if (status === 'FEATURE_DISABLED') throw new ProviderRegistryError('PROVIDER_DISABLED', 'Provider is disabled.', provider);
    if (status === 'CONFIG_PENDING') throw new ProviderRegistryError('PROVIDER_CONFIG_PENDING', 'Provider configuration is pending.', provider);
    if (status !== 'ENABLED') throw new ProviderRegistryError('PROVIDER_CONFIG_INVALID', 'Unknown provider availability.', provider);
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new ProviderRegistryError('PROVIDER_ADAPTER_UNAVAILABLE', 'Enabled provider has no adapter.', provider);
    return adapter;
  }
}
