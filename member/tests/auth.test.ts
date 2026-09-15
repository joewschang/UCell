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
