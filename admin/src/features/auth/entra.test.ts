import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({initialize:vi.fn(),handleRedirectPromise:vi.fn(),loginRedirect:vi.fn(),setActiveAccount:vi.fn()}));
vi.mock('@azure/msal-browser',()=>({PublicClientApplication:class{
  initialize=mock.initialize;handleRedirectPromise=mock.handleRedirectPromise;
  loginRedirect=mock.loginRedirect;setActiveAccount=mock.setActiveAccount;
}}));
beforeEach(()=>{
  vi.resetModules();vi.resetAllMocks();
  vi.stubGlobal('window',{location:{origin:'https://admin-stage.ucell.life'}});
  vi.stubEnv('VITE_ENTRA_CLIENT_ID','stage-client');vi.stubEnv('VITE_ENTRA_TENANT_ID','stage-tenant');
  mock.initialize.mockResolvedValue(undefined);mock.handleRedirectPromise.mockResolvedValue(null);
});
describe('Microsoft redirect login',()=>{
  it('waits for shared initialization before handling concurrent callbacks',async()=>{
    let finish!:()=>void;mock.initialize.mockReturnValue(new Promise<void>(resolve=>{finish=resolve}));
    const auth=await import('./entra');const a=auth.completeEntraRedirect(),b=auth.completeEntraRedirect();
    expect(mock.handleRedirectPromise).not.toHaveBeenCalled();finish();await Promise.all([a,b]);
    expect(mock.initialize).toHaveBeenCalledTimes(1);expect(mock.handleRedirectPromise).toHaveBeenCalledTimes(1);
  });
  it('does not initiate login on a normal page load',async()=>{
    const auth=await import('./entra');expect(await auth.completeEntraRedirect()).toBeNull();
    expect(mock.loginRedirect).not.toHaveBeenCalled();
  });
  it('returns a validated callback token and selects its account',async()=>{
    mock.handleRedirectPromise.mockResolvedValue({idToken:'test-token',account:{homeAccountId:'test'}});
    const auth=await import('./entra');expect(await auth.completeEntraRedirect()).toBe('test-token');
    expect(mock.setActiveAccount).toHaveBeenCalledWith({homeAccountId:'test'});
  });
  it('rejects an incomplete callback',async()=>{
    mock.handleRedirectPromise.mockResolvedValue({idToken:''});const auth=await import('./entra');
    await expect(auth.completeEntraRedirect()).rejects.toThrow();expect(mock.loginRedirect).not.toHaveBeenCalled();
  });
  it('allows an explicit fresh login after a failed callback',async()=>{
    mock.handleRedirectPromise.mockRejectedValue(new Error('invalid state'));const auth=await import('./entra');
    await expect(auth.completeEntraRedirect()).rejects.toThrow('invalid state');await auth.startEntraLogin();
    expect(mock.loginRedirect).toHaveBeenCalledWith({scopes:['openid','profile','email'],prompt:'select_account'});
  });
});
