import { AnalyticsRefreshWorker,refreshConfiguration,refreshKey } from '../src/modules/analytics/analytics.refresh';
const root='12345678-1234-5123-a123-123456789012';
function config(values:Record<string,string>){return {get:(key:string)=>values[key]};}
describe('Automatic analytics refresh',()=>{
  afterEach(()=>jest.useRealTimers());
  test('disabled by default and forbidden in read-only DEV',()=>{
    expect(refreshConfiguration(()=>undefined)).toEqual({enabled:false,seconds:300,scopes:['GLOBAL']});
    expect(()=>refreshConfiguration(config({UCELL_ANALYTICS_REFRESH_ENABLED:'true',UCELL_ADMIN_DEV_READ_ONLY:'true'}).get)).toThrow('READ_ONLY');
    expect(()=>refreshConfiguration(config({UCELL_ANALYTICS_REFRESH_SECONDS:'59'}).get)).toThrow();
    expect(()=>refreshConfiguration(config({UCELL_ANALYTICS_REFRESH_ROOTS:'not-a-uuid'}).get)).toThrow();
  });
  test('deduplicates roots and keys retries by scope, version, time slot',()=>{
    const c=refreshConfiguration(config({UCELL_ANALYTICS_REFRESH_ROOTS:`${root},${root}`}).get);expect(c.scopes).toEqual(['GLOBAL',root]);
    expect(refreshKey(root,100)).toBe(refreshKey(root,100));expect(refreshKey(root,100)).not.toBe(refreshKey('GLOBAL',100));expect(refreshKey(root,100)).not.toBe(refreshKey(root,101));
  });
  test('disabled worker never schedules or writes',async()=>{
    jest.useFakeTimers();const service={rebuild:jest.fn(),scopeFreshness:jest.fn(async()=>[])};
    const worker=new AnalyticsRefreshWorker(service as any,config({}) as any);worker.onApplicationBootstrap();await worker.runOnce();await jest.advanceTimersByTimeAsync(600000);
    expect(service.rebuild).not.toHaveBeenCalled();await worker.onApplicationShutdown();
  });
  test('automatic first cycle, retries same UUID, no concurrent local cycle, and stops on shutdown',async()=>{
    jest.useFakeTimers();jest.setSystemTime(new Date('2026-09-18T00:00:00Z'));
    const service={rebuild:jest.fn().mockRejectedValueOnce(new Error('ANALYTICS_REBUILD_IN_PROGRESS')).mockImplementation(async(id:string)=>({snapshotId:id})),scopeFreshness:jest.fn(async()=>[])};
    const worker=new AnalyticsRefreshWorker(service as any,config({UCELL_ANALYTICS_REFRESH_ENABLED:'true',UCELL_ANALYTICS_REFRESH_ROOTS:root}) as any);
    worker.onApplicationBootstrap();await jest.advanceTimersByTimeAsync(1);const first=worker.runOnce(),second=worker.runOnce();expect(first).toBe(second);
    await jest.advanceTimersByTimeAsync(1000);await first;
    expect(service.rebuild).toHaveBeenCalledTimes(3);expect(service.rebuild.mock.calls[0][0]).toBe(service.rebuild.mock.calls[1][0]);
    expect((await worker.status()).lastSuccessAt).not.toBeNull();await worker.onApplicationShutdown();await jest.advanceTimersByTimeAsync(900000);expect(service.rebuild).toHaveBeenCalledTimes(3);
  });
  test('failed scope is visible, errors sanitized, later scope still runs',async()=>{
    jest.useFakeTimers();const service={rebuild:jest.fn(async(id:string,scope:string|undefined)=>{if(!scope)throw new Error('SQL credentials private data');return {snapshotId:id};}),scopeFreshness:jest.fn(async()=>[])};
    const worker=new AnalyticsRefreshWorker(service as any,config({UCELL_ANALYTICS_REFRESH_ENABLED:'true',UCELL_ANALYTICS_REFRESH_ROOTS:root}) as any);
    const run=worker.runOnce();await jest.advanceTimersByTimeAsync(1000);await run;
    const status=await worker.status();expect(status.lastSuccessAt).toBeNull();expect(status.results.map(r=>r.status)).toEqual(['FAILED','SUCCESS']);expect(JSON.stringify(status)).not.toContain('credentials');await worker.onApplicationShutdown();
  });
});
