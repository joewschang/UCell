import { WorkerLoop, workerPollInterval } from '../../worker/src/worker-loop';

describe('Worker loop lifecycle',()=>{
  it('prevents overlapping ticks',async()=>{
    let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});const tick=jest.fn(()=>pending);const disconnect=jest.fn(async()=>undefined);const loop=new WorkerLoop({tick,disconnect},2000);
    const first=loop.runOnce();await Promise.resolve();await expect(loop.runOnce()).resolves.toBe(false);expect(tick).toHaveBeenCalledTimes(1);release();await expect(first).resolves.toBe(true);await loop.stop();expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('drains in-flight work before disconnect and makes stop idempotent',async()=>{
    const order:string[]=[];let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});const loop=new WorkerLoop({tick:async()=>{order.push('tick');await pending;order.push('done')},disconnect:async()=>{order.push('disconnect')}},1000);
    const running=loop.runOnce();await Promise.resolve();const stopping=loop.stop();expect(order).toEqual(['tick']);release();await Promise.all([running,stopping,loop.stop()]);expect(order).toEqual(['tick','done','disconnect']);expect(loop.state()).toMatchObject({stopping:true,running:false});await expect(loop.runOnce()).resolves.toBe(false);
  });

  it('runs once before scheduling and rejects duplicate start',async()=>{
    let callback:()=>void=()=>undefined;const clear=jest.fn();const tick=jest.fn(async()=>undefined);const loop=new WorkerLoop({tick,disconnect:async()=>undefined,setIntervalFn:(next=>{callback=next;return 1 as any}),clearIntervalFn:clear},500);
    await loop.start();expect(tick).toHaveBeenCalledTimes(1);callback();await Promise.resolve();expect(tick).toHaveBeenCalledTimes(2);await expect(loop.start()).rejects.toThrow('WORKER_LOOP_ALREADY_STARTED');await loop.stop();expect(clear).toHaveBeenCalledTimes(1);
  });

  it('validates the configured interval',()=>{
    expect(workerPollInterval({})).toBe(2000);expect(workerPollInterval({UCELL_WORKER_POLL_INTERVAL_MS:'250'})).toBe(250);expect(()=>workerPollInterval({UCELL_WORKER_POLL_INTERVAL_MS:'249'})).toThrow('WORKER_POLL_INTERVAL_INVALID');expect(()=>workerPollInterval({UCELL_WORKER_POLL_INTERVAL_MS:'1.5'})).toThrow('WORKER_POLL_INTERVAL_INVALID');
  });
});