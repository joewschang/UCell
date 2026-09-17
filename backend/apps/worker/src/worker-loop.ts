export type WorkerLoopState = Readonly<{started:boolean;stopping:boolean;running:boolean}>;

type TimerHandle = ReturnType<typeof setInterval>;
type WorkerLoopDependencies = Readonly<{
  tick:()=>Promise<void>;
  disconnect:()=>Promise<void>;
  onError?:(error:unknown)=>void;
  setIntervalFn?:(callback:()=>void,intervalMs:number)=>TimerHandle;
  clearIntervalFn?:(handle:TimerHandle)=>void;
}>;

/** Serial worker loop with overlap prevention and drain-before-disconnect shutdown. */
export class WorkerLoop {
  private readonly intervalMs:number;
  private readonly dependencies:Required<Pick<WorkerLoopDependencies,'tick'|'disconnect'>> & WorkerLoopDependencies;
  private timer:TimerHandle|null=null;
  private inFlight:Promise<void>|null=null;
  private started=false;
  private stopping=false;
  private stopPromise:Promise<void>|null=null;

  constructor(dependencies:WorkerLoopDependencies,intervalMs:number){
    this.dependencies=dependencies;
    this.intervalMs=assertWorkerPollInterval(intervalMs);
  }

  state():WorkerLoopState{return Object.freeze({started:this.started,stopping:this.stopping,running:this.inFlight!==null});}

  async start():Promise<void>{
    if(this.started)throw new Error('WORKER_LOOP_ALREADY_STARTED');
    this.started=true;
    await this.runOnce();
    if(this.stopping)return;
    const schedule=this.dependencies.setIntervalFn??setInterval;
    this.timer=schedule(()=>{void this.runOnce().catch(error=>this.dependencies.onError?.(error));},this.intervalMs);
  }

  async runOnce():Promise<boolean>{
    if(this.stopping||this.inFlight)return false;
    const work=Promise.resolve().then(()=>this.dependencies.tick());
    this.inFlight=work;
    try{await work;return true;}finally{if(this.inFlight===work)this.inFlight=null;}
  }

  async stop():Promise<void>{
    if(this.stopPromise)return this.stopPromise;
    this.stopping=true;
    if(this.timer){(this.dependencies.clearIntervalFn??clearInterval)(this.timer);this.timer=null;}
    this.stopPromise=(async()=>{
      try{await this.inFlight;}catch(error){this.dependencies.onError?.(error);}finally{await this.dependencies.disconnect();}
    })();
    return this.stopPromise;
  }
}

export function workerPollInterval(environment:NodeJS.ProcessEnv=process.env):number{
  const raw=environment.UCELL_WORKER_POLL_INTERVAL_MS??'2000';
  return assertWorkerPollInterval(Number(raw));
}

function assertWorkerPollInterval(value:number):number{
  if(!Number.isSafeInteger(value)||value<250||value>60_000)throw new Error('WORKER_POLL_INTERVAL_INVALID');
  return value;
}