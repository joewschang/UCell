import {PrismaClient} from '@prisma/client';
import {executePeriodClose} from '@ucell/settlement';
import {pollPeriodCloseJobs} from '../../../worker/src/period-close-runtime';
import {WorkerLoop} from '../../../worker/src/worker-loop';

async function main(){
  const [jobId,boundary]=process.argv.slice(2),url=process.env.PHASE2_TEST_DATABASE_URL!;
  const target=new URL(url);
  if(!['localhost','127.0.0.1'].includes(target.hostname)||!/^\/ucell_job_crash_[a-f0-9]{32}$/.test(target.pathname)||!['BEFORE_SEAL','AFTER_COMMIT','ONCE'].includes(boundary))throw new Error('DISPOSABLE_WORKER_TEST_REQUIRED');
  const db=new PrismaClient({datasources:{db:{url}}});
  const job=await db.periodCloseJob.findUniqueOrThrow({where:{periodCloseJobId:jobId}});
  if(!job.ruleVersionCode.startsWith('TEST_JOB_CRASH_'))throw new Error('TEST_JOB_REQUIRED');
  let backendPid:number|undefined;
  async function pause(){
    process.send!({type:'READY',boundary,backendPid});
    setInterval(()=>{},1000);
    await new Promise(()=>{});
  }
  const loop=new WorkerLoop({disconnect:()=>db.$disconnect(),tick:async()=>{
    await pollPeriodCloseJobs(db as any,{PERIOD_CLOSE_WORKER_ENABLED:'true'},async(tx,row)=>{
      if(row.periodCloseJobId!==jobId)return executePeriodClose(tx,row);
      backendPid=(await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`)[0].pid;
      const transaction=new Proxy(tx,{get(target,key){
        if(key!=='historicalReplaySnapshot'||boundary!=='BEFORE_SEAL')return Reflect.get(target,key);
        return new Proxy(target.historicalReplaySnapshot,{get(delegate,method){
          return method==='create'?async()=>{await pause();throw new Error('UNREACHABLE_AFTER_KILL');}:Reflect.get(delegate,method);
        }});
      }});
      return executePeriodClose(transaction,row);
    });
    if(boundary==='AFTER_COMMIT'&&await db.periodCloseReceipt.findUnique({where:{periodCloseJobId:jobId}}))await pause();
  }},250);
  try{
    await loop.start();
    const completed=!!await db.periodCloseReceipt.findUnique({where:{periodCloseJobId:jobId}});
    await loop.stop();
    process.send!({type:'COMPLETE',completed});
  }finally{await db.$disconnect();}
}
main().then(()=>process.disconnect()).catch(error=>process.send?.({type:'ERROR',message:error.message},()=>process.exit(1)));
