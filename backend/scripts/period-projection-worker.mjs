// Dedicated analytics worker: long rebuilds never block the monetary outbox worker.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
createRequire(new URL('../apps/api/package.json',import.meta.url))('reflect-metadata');
const {PrismaService}=require('../packages/database/dist');
const {PeriodProjectionService}=require('../apps/api/dist/modules/analytics/period-projection.service');
const {PeriodExportService}=require('../apps/api/dist/modules/analytics/period-export.service');
const watch=process.argv.length===3&&process.argv[2]==='--watch';
if(process.argv.length>2&&!watch)throw Error('EXPECTED_OPTIONAL_WATCH_FLAG');
const max=Number(process.env.UCELL_PERIOD_WORKER_MAX_JOBS??1),poll=Number(process.env.UCELL_PERIOD_WORKER_POLL_MS??5000);
if(!Number.isSafeInteger(max)||max<1||max>100)throw Error('PERIOD_WORKER_MAX_JOBS_1_TO_100');
if(!Number.isSafeInteger(poll)||poll<1000||poll>60000)throw Error('PERIOD_WORKER_POLL_MS_1000_TO_60000');
const db=new PrismaService(),projections=new PeriodProjectionService(db),exports=new PeriodExportService(db,projections);
let stopping=false,wake;
const stop=()=>{stopping=true;wake?.();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
const idle=()=>new Promise(resolve=>{const timer=setTimeout(()=>{wake=undefined;resolve();},poll);wake=()=>{clearTimeout(timer);wake=undefined;resolve();};});
try{
 do{
  let didWork=false;
  for(let i=0;i<max&&!stopping;i++){
   const projection=await projections.runOne(),exportJob=stopping?null:await exports.runOne();
   if(projection||exportJob||!watch)console.log(JSON.stringify({projection,exportJob}));
   didWork=didWork||!!projection||!!exportJob;
   if(!watch&&(projection?.status==='FAILED'||exportJob?.status==='FAILED'))process.exitCode=1;
   if(!projection&&!exportJob)break;
  }
  if(watch&&!stopping&&!didWork)await idle();
 }while(watch&&!stopping);
}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await db.$disconnect();}
