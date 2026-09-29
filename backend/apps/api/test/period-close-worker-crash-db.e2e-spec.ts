import {PrismaClient,Prisma} from '@prisma/client';
import {enqueuePeriodCloseJob,claimPeriodCloseJob,processPeriodCloseJob,PeriodCloseKind,verifyReplayEnvelope} from '@ucell/database';
import {SettlementCalendarService,executePeriodClose} from '@ucell/settlement';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {join} from 'node:path';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('period-close Worker process death and redelivery',()=>{
  let db:PrismaClient,control:PrismaClient,targetUrl:string,created=false;
  const database='ucell_job_crash_'+randomUUID().replaceAll('-','');
  const start=new Date('1895-01-01T00:00:00Z'),end=new Date('1895-01-08T00:00:00Z');
  beforeAll(async()=>{
    const target=new URL(url!);
    if(!['localhost','127.0.0.1'].includes(target.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(target.pathname))throw new Error('ISOLATED_RUNNER_REQUIRED');
    const admin=new URL(target);admin.pathname='/postgres';
    control=new PrismaClient({datasources:{db:{url:admin.href}}});
    await control.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;
    target.pathname='/'+database;targetUrl=target.href;
    const root=join(__dirname,'../../../packages/database');
    execFileSync(process.execPath,[require.resolve('prisma/build/index.js',{paths:[root]}),'migrate','deploy','--schema',join(root,'prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:targetUrl},stdio:'pipe',timeout:60000});
    db=new PrismaClient({datasources:{db:{url:targetUrl}}});
  },90000);
  afterAll(async()=>{
    await db?.$disconnect();
    if(created)await control.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');
    await control?.$disconnect();
  });
  async function fixture(kind:PeriodCloseKind){
    const rule=`TEST_JOB_CRASH_${randomUUID()}`;
    const values:Array<[string,string,Prisma.InputJsonValue]>=[['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['pool.binary.rate','*','0.2'],['pool.matching.rate','*','0.2'],['binary.pair.rate','*','0.1'],['pool.global.rate','*','0.05']];
    for(const type of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'])values.push(['settlement.timezone',type,'UTC'],['settlement.period',type,{unit:'WEEK',count:1,anchorLocal:'1895-01-01T00:00:00'}],['settlement.cut_off',type,{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST'}]);
    for(const rank of ['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'])values.push(['global.rank.weak_threshold',rank,'1000'],['global.rank.pool_rate',rank,'0.01']);
    for(const [parameterCode,scopeKey,valueJson] of values)await db.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01Z'),effectiveTo:new Date('1896-01-01Z')}});
    const admit=(type:PeriodCloseKind,prerequisiteIds:string[]=[])=>enqueuePeriodCloseJob(db,{kind:type,periodStart:start,periodEnd:end,ruleVersionCode:rule,prerequisiteIds,requestedBy:'TEST_FINANCE',approvalReference:'TEST'},tx=>new SettlementCalendarService(db as any).captureForPeriod(tx,start,end,type,rule));
    const prerequisites:string[]=[];
    if(kind==='MATCHING_K2'){
      const binary=await admit('BINARY_K1');
      await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,binary.periodCloseJobId))!,executePeriodClose);
      prerequisites.push(binary.periodCloseJobId);
    }
    return admit(kind,prerequisites);
  }
  async function state(rule:string){
    const jobs=await db.periodCloseJob.findMany({where:{ruleVersionCode:rule},orderBy:{periodCloseJobId:'asc'}});
    return Promise.all([
      db.settlementBatch.findMany({where:{ruleVersionCode:rule},orderBy:{settlementBatchId:'asc'}}),
      db.globalPoolSettlement.findMany({where:{ruleVersionCode:rule},orderBy:{globalPoolSettlementId:'asc'}}),
      db.historicalReplaySnapshot.findMany({where:{ruleVersionCode:rule},orderBy:{snapshotId:'asc'}}),
      db.periodCloseReceipt.findMany({where:{periodCloseJobId:{in:jobs.map(row=>row.periodCloseJobId)}},orderBy:{periodCloseJobId:'asc'}}),
      db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}}),
      db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}}),
      db.reservoirLedgerEffect.findMany({where:{ruleVersionCode:rule},orderBy:{reservoirLedgerEffectId:'asc'}}),
    ]);
  }
  async function child(jobId:string,boundary:'BEFORE_SEAL'|'AFTER_COMMIT'|'ONCE'){
    const worker=spawn(process.execPath,['-r',require.resolve('ts-node/register/transpile-only'),join(__dirname,'helpers/period-close-worker-process.ts'),jobId,boundary],{env:{...process.env,PHASE2_TEST_DATABASE_URL:targetUrl,TS_NODE_PROJECT:join(__dirname,'../tsconfig.json')},stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});
    let ready=false,completed:boolean|undefined,pid:number|undefined,stderr='';
    worker.stderr!.on('data',chunk=>{stderr=(stderr+chunk).slice(-1500);});
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>{worker.kill('SIGKILL');reject(new Error('WORKER_TEST_TIMEOUT'));},25000);
      worker.on('error',error=>{clearTimeout(timeout);reject(error);});
      worker.on('message',(message:any)=>{
        if(message.type==='ERROR'){worker.kill('SIGKILL');clearTimeout(timeout);reject(new Error(message.message));}
        if(message.type==='COMPLETE')completed=message.completed;
        if(message.type==='READY'){ready=message.boundary===boundary;pid=message.backendPid;worker.kill('SIGKILL');}
      });
      worker.on('exit',(code,signal)=>{
        clearTimeout(timeout);
        if(boundary==='ONCE'?typeof completed==='boolean'&&code===0:ready&&worker.killed&&(signal==='SIGKILL'||code!==0))resolve();
        else reject(new Error(`WORKER_EXIT_${code}_${signal}: ${stderr}`));
      });
    });
    if(boundary==='ONCE')return completed;
    expect(pid).toEqual(expect.any(Number));
    for(let attempt=0;attempt<100;attempt++){
      const rows=await db.$queryRaw<Array<{pid:number}>>`SELECT pid FROM pg_stat_activity WHERE pid=${pid!} AND datname=current_database()`;
      if(!rows.length)return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error('WORKER_DATABASE_SESSION_NOT_CLOSED');
  }
  const cases=(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'] as const).flatMap(kind=>(['BEFORE_SEAL','AFTER_COMMIT'] as const).map(boundary=>[kind,boundary] as const));
  it.each(cases)('recovers %s Worker delivery killed at %s',async(kind,boundary)=>{
    const job=await fixture(kind),before=await state(job.ruleVersionCode);
    await child(job.periodCloseJobId,boundary);
    const stopped=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}});
    expect(stopped.attemptCount).toBe(1);
    if(boundary==='BEFORE_SEAL'){
      expect(stopped.processStatus).toBe('PROCESSING');expect(await state(job.ruleVersionCode)).toEqual(before);
      expect(await child(job.periodCloseJobId,'ONCE')).toBe(false);
      expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}})).attemptCount).toBe(1);
      // Advance only this disposable lease deadline; do not wait two real minutes.
      await db.outboxEvent.update({where:{outboxEventId:job.outboxEventId},data:{availableAt:new Date(Date.now()-1000)}});
    }else expect(stopped.processStatus).toBe('PROCESSED');
    const committed=boundary==='AFTER_COMMIT'?await state(job.ruleVersionCode):null;
    expect(await child(job.periodCloseJobId,'ONCE')).toBe(true);
    const receipt=await db.periodCloseReceipt.findUniqueOrThrow({where:{periodCloseJobId:job.periodCloseJobId}});
    const envelope=verifyReplayEnvelope(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:receipt.snapshotId}}));
    expect(envelope).toMatchObject({kind,sourceId:receipt.sourceId,ruleVersionCode:job.ruleVersionCode});
    const done=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}});
    expect(done.processStatus).toBe('PROCESSED');expect(done.attemptCount).toBe(boundary==='BEFORE_SEAL'?2:1);
    if(committed)expect(await state(job.ruleVersionCode)).toEqual(committed);
    const recovered=await state(job.ruleVersionCode);
    expect(await child(job.periodCloseJobId,'ONCE')).toBe(true);
    expect(await state(job.ruleVersionCode)).toEqual(recovered);
    expect(await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}})).toEqual(done);
  },90000);
});
