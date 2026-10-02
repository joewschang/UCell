import {afterEach,expect,it,vi} from 'vitest';
const sdk=vi.hoisted(()=>({getIDToken:vi.fn()}));
vi.mock('@line/liff',()=>({default:sdk}));
import {requestLineBinding,completeLineBinding} from '../src/lineBinding';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
function response(data:unknown){return new Response(JSON.stringify({data,meta:{api_version:'v1',request_id:'test',timestamp:new Date().toISOString()}}),{status:201});}
it('sends verified-token input and company case without a client member_id or subject',async()=>{
 sdk.getIDToken.mockReturnValue('TEST_TOKEN');
 const fetcher=vi.fn().mockResolvedValue(response({requestId:'request',status:'PENDING'}));vi.stubGlobal('fetch',fetcher);
 expect(await requestLineBinding('2609250001','CASE-001','stable-key')).toBe('request');
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({memberNo:'2609250001',verificationReference:'CASE-001',idToken:'TEST_TOKEN'});
 expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe('stable-key');
});
it('does not submit without a LINE token',async()=>{
 sdk.getIDToken.mockReturnValue(null);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(completeLineBinding('request','proof')).rejects.toThrow('失效');expect(fetcher).not.toHaveBeenCalled();
});
it('persists only the server session after approved completion',async()=>{
 sdk.getIDToken.mockReturnValue('TEST_TOKEN');const storage={setItem:vi.fn(),removeItem:vi.fn()};vi.stubGlobal('sessionStorage',storage);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({accessToken:'opaque',expiresAt:new Date(Date.now()+60000).toISOString()})));
 await completeLineBinding('request','secret-proof');expect(storage.setItem.mock.calls).toEqual([['ucell_member_token','opaque']]);
});
it.each([401,409,503])('never authenticates a rejected completion (%s)',async(status)=>{
 sdk.getIDToken.mockReturnValue('TEST_TOKEN');const storage={setItem:vi.fn()};vi.stubGlobal('sessionStorage',storage);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status})));
 await expect(completeLineBinding('request','secret-proof')).rejects.toThrow();expect(storage.setItem).not.toHaveBeenCalled();
});

it('contains SDK initialization failures without exposing provider internals or submitting a proof',async()=>{
 sdk.getIDToken.mockImplementationOnce(()=>{throw new Error('SDK_PRIVATE_FAILURE')});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(completeLineBinding('request','proof')).rejects.toThrow('LINE 登入已失效');expect(fetcher).not.toHaveBeenCalled();
});
