import { handlerResolver, pollProviderWebhooks, providerRuntimeConfig,validatePinnedProviderConnections } from '../../worker/src/provider-runtime';

describe('Provider worker runtime wiring',()=>{
  it('pins logistics handlers to the approved manifest and database connection version',async()=>{
    const item:any={domain:'LOGISTICS',provider:'OTHER',connectionId:'primary',providerConnectionVersionId:'version-1',handler:{process:jest.fn()}};
    const entry:any={...item,connectionEnvironment:'STAGE',configHash:'hash',credentialSecretRef:'secret-ref',webhookVerificationRef:'verify-ref',approvalReference:'approval-ref'};
    const version:any={...entry,environment:'STAGE',effectiveFrom:new Date(0),effectiveTo:null,connection:{domain:'LOGISTICS',provider:'OTHER',connectionKey:'primary',status:'ACTIVE'}};
    const db:any={providerConnectionVersion:{findUnique:jest.fn().mockResolvedValue(version)}},manifest:any={entries:[entry]},now=new Date();
    await expect(validatePinnedProviderConnections(db,[item],manifest,now)).resolves.toBeUndefined();
    await expect(validatePinnedProviderConnections(db,[{...item,providerConnectionVersionId:undefined}],manifest,now)).rejects.toThrow('PROVIDER_HANDLER_VERSION_REQUIRED');
    await expect(validatePinnedProviderConnections(db,[{...item,providerConnectionVersionId:'foreign'}],manifest,now)).rejects.toThrow('PROVIDER_HANDLER_VERSION_MISMATCH');
    db.providerConnectionVersion.findUnique.mockResolvedValue({...version,configHash:'changed'});
    await expect(validatePinnedProviderConnections(db,[item],manifest,now)).rejects.toThrow('PROVIDER_HANDLER_VERSION_MISMATCH');
  });
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
