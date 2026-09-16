import {expect,it,vi} from 'vitest';
import {createCommandClient} from './commands';
it('coalesces double submission and preserves a failed key for retry',async()=>{
 const send=vi.fn().mockRejectedValueOnce(Error('response lost')).mockResolvedValue({id:'persisted'});
 const key=vi.fn().mockReturnValueOnce('one').mockReturnValueOnce('two');
 const client=createCommandClient(send,()=> 'actor',key);
 const a=client.execute('/orders',{items:['product']});const b=client.execute('/orders',{items:['product']});
 expect(a).toBe(b);await expect(a).rejects.toThrow('response lost');
 await expect(client.execute('/orders',{items:['product']})).resolves.toEqual({id:'persisted'});
 expect(send.mock.calls.map(row=>row[2])).toEqual(['one','one']);expect(key).toHaveBeenCalledTimes(1);
 await client.execute('/orders',{items:['product']});expect(send.mock.calls[2][2]).toBe('two');
});
it('separates changed payloads and authenticated actors',async()=>{
 let actor='A';let n=0;const send=vi.fn().mockRejectedValue(Error('retry'));
 const client=createCommandClient(send,()=>actor,()=>String(++n));
 await client.execute('/profile',{name:'first'}).catch(()=>{});
 await client.execute('/profile',{name:'second'}).catch(()=>{});actor='B';
 await client.execute('/profile',{name:'first'}).catch(()=>{});
 expect(send.mock.calls.map(row=>row[2])).toEqual(['1','2','3']);
});
it('does not send queued work with a different authenticated actor',async()=>{
 let actor='A';const send=vi.fn();const client=createCommandClient(send,()=>actor,()=> 'key');
 const request=client.execute('/orders',{items:['product']});actor='B';
 await expect(request).rejects.toThrow('工作階段已變更');expect(send).not.toHaveBeenCalled();
});
