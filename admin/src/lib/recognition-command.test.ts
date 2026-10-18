import {afterEach,expect,it,vi} from 'vitest';
import {createCommandClient} from './commands';
const path='/admin/rpv/recognitions/11111111-1111-4111-8111-111111111111/run';
const conflict={status:409,body:{code:'RECOGNITION_RETRY_EXHAUSTED',details:{retryable:true,attempts:4}}};
afterEach(()=>vi.useRealTimers());
it('resends an identical recognition and coalesces clicks while backing off',async()=>{
 vi.useFakeTimers();const send=vi.fn().mockRejectedValueOnce(conflict).mockResolvedValue({ok:true});
 const client=createCommandClient(send,()=> 'admin',()=> 'same-key');const body={note:'original'};
 const first=client.execute(path,body),second=client.execute(path,body);expect(first).toBe(second);body.note='changed';
 await vi.runAllTimersAsync();await expect(first).resolves.toEqual({ok:true});
 expect(send.mock.calls).toEqual([[path,{note:'original'},'same-key'],[path,{note:'original'},'same-key']]);
});
it('stops after four requests and retains the key for a later explicit retry',async()=>{
 vi.useFakeTimers();const send=vi.fn().mockRejectedValue(conflict),client=createCommandClient(send,()=> 'admin',()=> 'same-key');
 const result=client.execute(path).catch(e=>e);await vi.runAllTimersAsync();expect(await result).toBe(conflict);expect(send).toHaveBeenCalledTimes(4);
 send.mockResolvedValue({ok:true});await client.execute(path);expect(send.mock.calls[4][2]).toBe('same-key');
});
it.each([0,401,403,422,500])('does not automatically retry HTTP %i',async status=>{
 const send=vi.fn().mockRejectedValue({...conflict,status});await createCommandClient(send,()=> 'admin').execute(path).catch(()=>{});expect(send).toHaveBeenCalledTimes(1);
});
it.each([{status:409,body:{code:'OTHER_CONFLICT'}},{status:409,body:{code:'RECOGNITION_RETRY_EXHAUSTED',details:{retryable:false,attempts:4}}},Error('network lost')])('does not retry ambiguous or other failures',async error=>{
 const send=vi.fn().mockRejectedValue(error);await createCommandClient(send,()=> 'admin').execute(path).catch(()=>{});expect(send).toHaveBeenCalledTimes(1);
});
it('never resends unrelated financial commands even with the recognition error code',async()=>{
 const send=vi.fn().mockRejectedValue(conflict);await createCommandClient(send,()=> 'admin').execute('/admin/orders').catch(()=>{});expect(send).toHaveBeenCalledTimes(1);
});
it('checks identity again after backoff',async()=>{
 vi.useFakeTimers();let actor='A';const send=vi.fn().mockRejectedValue(conflict),client=createCommandClient(send,()=>actor);
 const result=client.execute(path).catch(e=>e);await vi.advanceTimersByTimeAsync(1);actor='B';await vi.runAllTimersAsync();expect(((await result) as Error).message).toContain('工作階段已變更');expect(send).toHaveBeenCalledTimes(1);
});

