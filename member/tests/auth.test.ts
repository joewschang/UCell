import { afterEach, expect, it, vi } from 'vitest';
const liff = vi.hoisted(() => ({ init: vi.fn(), isLoggedIn: vi.fn(), login: vi.fn(), getIDToken:vi.fn() }));
vi.mock('@line/liff', () => ({ default: liff }));
import { initLiff } from '../src/liff';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('requires an explicit mock flag', async () => {
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn(),getItem:vi.fn() });
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_LIFF_ID', '');
    await expect(initLiff()).rejects.toThrow('尚未設定');
    expect(liff.init).not.toHaveBeenCalled();
});
it('does not trust a LINE login as a UCell session', async () => {
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn(),getItem:vi.fn() });
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_LIFF_ID', 'test-id');
    liff.isLoggedIn.mockReturnValue(true);
    liff.getIDToken.mockReturnValue(null);
    await expect(initLiff()).rejects.toThrow('憑證不存在');
});
it('exchanges ID token only through backend and persists only the opaque Member session',async()=>{
 const storage={getItem:vi.fn(),removeItem:vi.fn(),setItem:vi.fn()};vi.stubGlobal('sessionStorage',storage);
 vi.stubEnv('VITE_ENABLE_MOCK','false');vi.stubEnv('VITE_LIFF_ID','TEST_ONLY');
 liff.isLoggedIn.mockReturnValue(true);liff.getIDToken.mockReturnValue('TEST_ONLY_ID_TOKEN');
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({data:{accessToken:'opaque',expiresAt:new Date(Date.now()+60000).toISOString()},meta:{api_version:'v1',request_id:'fixture',timestamp:new Date().toISOString()}}),{status:201}));vi.stubGlobal('fetch',fetcher);
 await expect(initLiff()).resolves.toEqual({mode:'connected'});
 expect(fetcher.mock.calls[0]).toHaveLength(2);
 expect(storage.setItem).toHaveBeenCalledWith('ucell_member_token','opaque');
 expect(storage.setItem).toHaveBeenCalledTimes(1);
});
it('fails closed when the backend rejects an ID token',async()=>{
 const storage={getItem:vi.fn(),removeItem:vi.fn(),setItem:vi.fn()};vi.stubGlobal('sessionStorage',storage);
 vi.stubEnv('VITE_ENABLE_MOCK','false');vi.stubEnv('VITE_LIFF_ID','TEST_ONLY');
 liff.isLoggedIn.mockReturnValue(true);liff.getIDToken.mockReturnValue('INVALID_TEST_ONLY');
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:401})));
 await expect(initLiff()).rejects.toThrow('驗證失敗');expect(storage.setItem).not.toHaveBeenCalled();
});
it('keeps redirect separate from an authenticated result', async () => {
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn() });
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_LIFF_ID', 'test-id');
    liff.isLoggedIn.mockReturnValue(false);
    await expect(initLiff()).resolves.toEqual({ mode: 'redirect' });
    expect(liff.login).toHaveBeenCalledTimes(1);
});
it('distinguishes a retryable exchange conflict from consumed LINE credentials',async()=>{
 const storage={getItem:vi.fn(),removeItem:vi.fn(),setItem:vi.fn()};vi.stubGlobal('sessionStorage',storage);
 vi.stubEnv('VITE_ENABLE_MOCK','false');vi.stubEnv('VITE_LIFF_ID','TEST_ONLY');
 liff.isLoggedIn.mockReturnValue(true);liff.getIDToken.mockReturnValue('RETRY_TEST_ONLY');
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({code:'RETRYABLE_CONFLICT'}),{status:409})));
 await expect(initLiff()).rejects.toThrow('操作衝突，請重試');expect(storage.setItem).not.toHaveBeenCalled();
});
it('records a referral landing before LINE redirect and keeps only opaque transition state',async()=>{
 const session=new Map<string,string>(),local=new Map<string,string>(),replaceState=vi.fn();
 vi.stubGlobal('sessionStorage',{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)});
 vi.stubGlobal('localStorage',{getItem:(key:string)=>local.get(key)??null,setItem:(key:string,value:string)=>local.set(key,value)});
 vi.stubGlobal('window',{location:{pathname:'/r/OPAQUE_SHARE_TOKEN',search:''},history:{replaceState}});
 vi.stubGlobal('crypto',{randomUUID:()=> '11111111-1111-4111-8111-111111111111'});
 vi.stubEnv('VITE_ENABLE_MOCK','false');vi.stubEnv('VITE_LIFF_ID','TEST_ONLY');liff.isLoggedIn.mockReturnValue(false);
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:{anonymousId:'22222222-2222-4222-8222-222222222222',transitionState:'OPAQUE_TRANSITION_STATE',transitionExpiresAt:new Date(Date.now()+60000).toISOString()},meta:{api_version:'v1',request_id:'fixture',timestamp:new Date().toISOString()}}),{status:201})));
 await expect(initLiff()).resolves.toEqual({mode:'redirect'});
 expect(session.get('ucell_referral_transition')).toBe('OPAQUE_TRANSITION_STATE');expect(local.get('ucell_referral_anonymous_id')).toBe('22222222-2222-4222-8222-222222222222');expect(replaceState).toHaveBeenCalledWith({},'','/');expect(liff.login).toHaveBeenCalledTimes(1);
});
it('routes an accepted referral landing to its published content destination',async()=>{
 const session=new Map<string,string>(),replaceState=vi.fn();vi.stubGlobal('sessionStorage',{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)});vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});vi.stubGlobal('window',{location:{pathname:'/r/OPAQUE_SHARE_TOKEN',search:'?content=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},history:{replaceState}});vi.stubGlobal('crypto',{randomUUID:()=> '11111111-1111-4111-8111-111111111111'});vi.stubEnv('VITE_ENABLE_MOCK','false');vi.stubEnv('VITE_LIFF_ID','TEST_ONLY');liff.isLoggedIn.mockReturnValue(false);vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:{anonymousId:'22222222-2222-4222-8222-222222222222',transitionState:'OPAQUE_TRANSITION_STATE',transitionExpiresAt:new Date(Date.now()+60000).toISOString()},meta:{api_version:'v1',request_id:'fixture',timestamp:new Date().toISOString()}}),{status:201})));await initLiff();expect(replaceState).toHaveBeenCalledWith({},'','/content/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});it('binds pending referral state after backend LINE exchange without sending it to LINE',async()=>{
 const session=new Map<string,string>([['ucell_referral_transition','OPAQUE_TRANSITION_STATE'],['ucell_referral_binding_key','11111111-1111-4111-8111-111111111111']]);
 vi.stubGlobal('sessionStorage',{getItem:(key:string)=>session.get(key)??null,setItem:(key:string,value:string)=>session.set(key,value),removeItem:(key:string)=>session.delete(key)});
 vi.stubEnv('VITE_ENABLE_MOCK','false');vi.stubEnv('VITE_LIFF_ID','TEST_ONLY');liff.isLoggedIn.mockReturnValue(true);liff.getIDToken.mockReturnValue('TEST_ONLY_ID_TOKEN');
 const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/line/exchange')?{data:{accessToken:'opaque',expiresAt:new Date(Date.now()+60000).toISOString()},meta:{api_version:'v1',request_id:'exchange',timestamp:new Date().toISOString()}}:{data:{status:'BOUND'},meta:{api_version:'v1',request_id:'bind',timestamp:new Date().toISOString()}}),{status:201}));vi.stubGlobal('fetch',fetcher);
 await expect(initLiff()).resolves.toEqual({mode:'connected',referralWarning:undefined});
 expect(fetcher).toHaveBeenCalledTimes(2);expect(String(fetcher.mock.calls[0][0])).toContain('/line/exchange');expect(String(fetcher.mock.calls[1][0])).toContain('/member/referrals/bind');expect(session.has('ucell_referral_transition')).toBe(false);
});
