import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {api,clearAdminToken,command,putCommand} from './api';
const memory=new Map<string,string>();
beforeEach(()=>{memory.clear();vi.stubGlobal('sessionStorage',{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)});vi.stubGlobal('window',{dispatchEvent:vi.fn()});clearAdminToken();});
afterEach(()=>{clearAdminToken();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('sends one concurrent command and retries a lost response with the same key and body',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(Error('response lost')).mockResolvedValue(new Response(JSON.stringify({data:{orderId:'original'}})));vi.stubGlobal('fetch',fetch);
 const body={qualificationId:'owned',items:[{productId:'product',quantity:'1'}]};
 const a=command('/admin/orders',body),b=command('/admin/orders',body);expect(a).toBe(b);await expect(a).rejects.toThrow('response lost');
 await expect(command('/admin/orders',body)).resolves.toEqual({data:{orderId:'original'}});
 const headers=fetch.mock.calls.map(row=>new Headers(row[1].headers));expect(headers[0].get('Idempotency-Key')).toBe(headers[1].get('Idempotency-Key'));expect(fetch).toHaveBeenCalledTimes(2);
 expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
});
it('bounds a stalled request without pretending that a write was rolled back',async()=>{
 vi.useFakeTimers();const fetch=vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')))));vi.stubGlobal('fetch',fetch);
 const request=api('/admin/orders',{method:'POST',body:'{}',idempotencyKey:'retry-me'});
 const assertion=expect(request).rejects.toThrow('保留原資料重試');await vi.advanceTimersByTimeAsync(15000);await assertion;
 expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);expect(window.dispatchEvent).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('uses PUT with an idempotency key for replace-style configuration commands',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{count:1}})));vi.stubGlobal('fetch',fetch);
 await putCommand('/admin/packages/versions/version/selectable-products',{products:[{productRuleProfileId:'rule',maxQty:1}]});
 expect(fetch.mock.calls[0][1].method).toBe('PUT');expect(new Headers(fetch.mock.calls[0][1].headers).get('Idempotency-Key')).toBeTruthy();
});
it('denies 401 and notifies session expiry; 403 remains a recoverable authorization error',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({message:'session expired'}),{status:401})).mockResolvedValueOnce(new Response(JSON.stringify({message:'qualification forbidden'}),{status:403}));vi.stubGlobal('fetch',fetch);
 await expect(api('/auth/admin/me')).rejects.toThrow('session expired');expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
 await expect(api('/admin/qualifications')).rejects.toThrow('qualification forbidden');expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
});
it('classifies 404 and offline failures for consistent UI states',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockRejectedValueOnce(new TypeError('Failed to fetch'));vi.stubGlobal('fetch',fetch);
 await expect(api('/admin/missing')).rejects.toMatchObject({status:404,message:expect.stringContaining('找不到指定資料')});
 await expect(api('/admin/offline')).rejects.toMatchObject({status:0,message:expect.stringContaining('無法連線')});
 expect(window.dispatchEvent).not.toHaveBeenCalled();
});
it('distinguishes caller cancellation from request timeout',async()=>{
 const fetch=vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')))));vi.stubGlobal('fetch',fetch);
 const controller=new AbortController();const request=api('/admin/slow',{signal:controller.signal});controller.abort();
 await expect(request).rejects.toMatchObject({status:0,message:expect.stringContaining('請求已取消')});
});
