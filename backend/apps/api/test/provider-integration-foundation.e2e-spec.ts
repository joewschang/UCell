import { ProviderRegistry } from '../src/modules/commerce/contracts/provider-registry';
import { ProviderWebhookInboxService } from '../src/modules/commerce/provider-webhook-inbox.service';
import type { InvoiceProviderAdapter } from '../src/modules/commerce/contracts/invoice';
import type { LogisticsProviderAdapter } from '../src/modules/commerce/contracts/logistics';

describe('Provider integration foundation', () => {
  const invoice = (provider: InvoiceProviderAdapter['provider']) => ({ provider }) as InvoiceProviderAdapter;
  const logistics = (provider: LogisticsProviderAdapter['provider']) => ({ provider }) as LogisticsProviderAdapter;

  it('keeps invoice providers disabled until explicitly configured', () => {
    const registry = new ProviderRegistry([invoice('ECPAY'), invoice('CHT_EINVOICE')], { ECPAY: 'CONFIG_PENDING' }, ['ECPAY', 'CHT_EINVOICE', 'OTHER'] as const);
    expect(registry.status('CHT_EINVOICE')).toBe('FEATURE_DISABLED');
    expect(() => registry.resolve('ECPAY')).toThrow(expect.objectContaining({ code: 'PROVIDER_CONFIG_PENDING' }));
    expect(() => registry.resolve('CHT_EINVOICE')).toThrow(expect.objectContaining({ code: 'PROVIDER_DISABLED' }));
  });

  it('resolves only one supported enabled logistics adapter', () => {
    const blackCat = logistics('BLACK_CAT');
    const registry = new ProviderRegistry([blackCat], { BLACK_CAT: 'ENABLED' }, ['BLACK_CAT', 'SEVEN_ELEVEN', 'ECPAY_LOGISTICS', 'OTHER'] as const);
    expect(registry.resolve('BLACK_CAT')).toBe(blackCat);
    expect(() => new ProviderRegistry(
      [blackCat, blackCat],
      { BLACK_CAT: 'ENABLED' },
      ['BLACK_CAT', 'SEVEN_ELEVEN', 'ECPAY_LOGISTICS', 'OTHER'] as const,
    )).toThrow(
      expect.objectContaining({ code: 'PROVIDER_DUPLICATE' }),
    );
  });

  it('hashes transient webhook bytes and persists only safe metadata', async () => {
    const upsert = jest.fn(async (args: any) => ({ ...args.create, providerWebhookInboxId: 'inbox-1', status: 'RECEIVED', receivedAt: new Date() }));
    const service = new ProviderWebhookInboxService({ providerWebhookInbox: { upsert } } as any);
    const rawBody = Buffer.from('{"transaction":"provider-secret-body"}', 'utf8');
    const result = await service.receive({
      domain: 'PAYMENT', provider: 'ECPAY', connectionId: 'stage-ecpay-1', rawBody,
      safeEvidenceRef: 'vault://safe/provider/webhook/1', verificationConfigVersion: 'stage-v1',
      correlationId: '00000000-0000-4000-8000-000000000001',
    });
    const serialized = JSON.stringify(upsert.mock.calls[0][0]);
    expect(serialized).not.toContain('provider-secret-body');
    expect(upsert.mock.calls[0][0].create.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(upsert.mock.calls[0][0].create.ingressKey).toMatch(/^[a-f0-9]{64}$/);
    expect(result.status).toBe('RECEIVED');
  });

  it('uses a deterministic ingress key so exact redelivery is idempotent', async () => {
    const keys: string[] = [];
    const upsert = jest.fn(async (args: any) => { keys.push(args.create.ingressKey); return args.create; });
    const service = new ProviderWebhookInboxService({ providerWebhookInbox: { upsert } } as any);
    const input = {
      domain: 'LOGISTICS' as const, provider: 'BLACK_CAT', connectionId: 'stage-tcat-1', rawBody: Buffer.from('same-event'),
      safeEvidenceRef: 'vault://safe/provider/webhook/2', verificationConfigVersion: 'stage-v1',
      correlationId: '00000000-0000-4000-8000-000000000002',
    };
    await service.receive(input);
    await service.receive(input);
    expect(keys[0]).toBe(keys[1]);
  });
});
