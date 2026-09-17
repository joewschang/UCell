import { handlerResolver, pollProviderWebhooks, providerRuntimeConfig } from '../../worker/src/provider-runtime';

describe('Provider worker runtime wiring',()=>{
  const lease:any={domain:'PAYMENT',provider:'ACME',connectionId:'primary'};

  it('is disabled by default without touching the database',async()=>{
    const db:any={$transaction:jest.fn()};
    await expect(pollProviderWebhooks(db,[],{},new Date('2026-09-19T00:00:00Z'))).resolves.toEqual({enabled:false,result:null});
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed before claiming when enabled without approved handlers',async()=>{
    const db:any={$transaction:jest.fn()};
    await expect(pollProviderWebhooks(db,[],{UCELL_PROVIDER_WORKER_ENABLED:'true',UCELL_PROVIDER_WORKER_LEASE_OWNER:'worker-1'},new Date('2026-09-19T00:00:00Z'))).rejects.toThrow('PROVIDER_HANDLER_REGISTRY_EMPTY');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('resolves only an exact domain/provider/connection registration',()=>{
    const handler={process:jest.fn()};const resolve=handlerResolver([{domain:'PAYMENT',provider:'ACME',connectionId:'primary',handler}]);
    expect(resolve(lease)).toBe(handler);expect(resolve({...lease,connectionId:'secondary'})).toBeNull();expect(resolve({...lease,domain:'INVOICE'})).toBeNull();
  });

  it('rejects duplicate and invalid runtime configuration',()=>{
    const handler={process:jest.fn()};
    expect(()=>handlerResolver([{domain:'PAYMENT',provider:'ACME',connectionId:'primary',handler},{domain:'PAYMENT',provider:'ACME',connectionId:'primary',handler}])).toThrow('PROVIDER_HANDLER_REGISTRY_DUPLICATE');
    expect(()=>providerRuntimeConfig({UCELL_PROVIDER_WORKER_ENABLED:'yes'})).toThrow('PROVIDER_WORKER_ENABLED_INVALID');
    expect(()=>providerRuntimeConfig({UCELL_PROVIDER_WORKER_ENABLED:'true',UCELL_PROVIDER_WORKER_LEASE_OWNER:'worker-1',UCELL_PROVIDER_WORKER_MAX_ATTEMPTS:'4',UCELL_PROVIDER_WORKER_RETRY_BACKOFF_SECONDS:'30,120'})).toThrow('PROVIDER_WORKER_BACKOFF_CONFIG_INVALID');
  });
});