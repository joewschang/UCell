import {PrismaClient,Prisma} from '@prisma/client';
import {enqueuePeriodCloseJob,claimPeriodCloseJob,processPeriodCloseJob,PeriodCloseKind,verifyReplayEnvelope,sealGpvEvent} from '@ucell/database';
import {SettlementCalendarService,executePeriodClose} from '@ucell/settlement';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {join} from 'node:path';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('period-close Worker process death and redelivery',()=>{
  let db:PrismaClient,control:PrismaClient,targetUrl:string,created=false;
  const database='ucell_job_crash_'+randomUUID().replaceAll('-','');
  let sequence=0;
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
    try{
      await db?.$disconnect();
      if(created)await control.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');
    }finally{await control?.$disconnect();}
  },30000);
  async function fixture(kind:PeriodCloseKind,funded:boolean){
    const start=new Date(Date.UTC(1895,0,1+(sequence++)*14)),end=new Date(start.getTime()+7*86400000);
    const rule=`TEST_JOB_CRASH_${randomUUID()}`;
    const values:Array<[string,string,Prisma.InputJsonValue]>=[['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['pool.binary.rate','*','0.2'],['pool.matching.rate','*','0.2'],['binary.pair.rate','*','0.1'],['pool.global.rate','*','0.05']];
    values.push(['binary.weekly.cap','STARTER','10000'],['referral.g1.rate','STARTER','0.15'],['matching.rate','1','0.1']);
    for(const type of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'])values.push(['settlement.timezone',type,'UTC'],['settlement.period',type,{unit:'WEEK',count:1,anchorLocal:start.toISOString().slice(0,19)}],['settlement.cut_off',type,{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST'}]);
    for(const rank of ['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'])values.push(['global.rank.weak_threshold',rank,rank==='NEW_STAR'?'100':'1000'],['global.rank.pool_rate',rank,rank==='NEW_STAR'?'0.02':'0.0075']);
    for(const [parameterCode,scopeKey,valueJson] of values)await db.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01Z'),effectiveTo:new Date('1896-01-01Z')}});
    if(funded)await db.$transaction(async tx=>{
      const from=new Date(start.getTime()-86400000),to=new Date(end.getTime()+86400000),at=new Date(start.getTime()+86400000);
      const person=await tx.person.create({data:{legalName:'SYNTHETIC WORKER RECOVERY'}}),qualifications=[];
      for(let i=0;i<(kind==='MATCHING_K2'?4:3);i++){
        const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:from}});qualifications.push(q);
        await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:from,effectiveTo:to,sourceType:'TEST_JOB_CRASH'}});
        await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:from,effectiveTo:to,sourceType:'TEST_JOB_CRASH'}});
        if(i===0||i===3)await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:from,activeTo:to,sourceType:'TEST_JOB_CRASH',ruleVersionCode:rule}});
        else{
          await tx.binaryPlacement.create({data:{parentQualificationId:qualifications[0].qualificationId,childQualificationId:q.qualificationId,side:i===1?'LEFT':'RIGHT',effectiveFrom:from,effectiveTo:kind==='GLOBAL'?null:to}});
          await tx.sponsorRelationship.create({data:{sponsorQualificationId:qualifications[0].qualificationId,childQualificationId:q.qualificationId,sponsorSequenceNo:i,effectiveFrom:from,effectiveTo:to}});
        }
        if(i===3)await tx.sponsorRelationship.create({data:{sponsorQualificationId:q.qualificationId,childQualificationId:qualifications[0].qualificationId,sponsorSequenceNo:1,effectiveFrom:from,effectiveTo:to}});
      }
      const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Worker recovery source',currentPrice:100}});
      for(const q of qualifications.slice(1,3)){
        const order=await tx.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:rule}});
        const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
        const event=await tx.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:rule,occurredAt:at,correlationId:randomUUID()}});
        await sealGpvEvent(tx,event);
      }
    },{timeout:30000});
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
    const awards=await db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}});
    const globals=await db.globalPoolSettlement.findMany({where:{ruleVersionCode:rule}});
    return Promise.all([
      db.settlementBatch.findMany({where:{ruleVersionCode:rule},orderBy:{settlementBatchId:'asc'}}),
      db.globalPoolSettlement.findMany({where:{ruleVersionCode:rule},orderBy:{globalPoolSettlementId:'asc'}}),
      db.historicalReplaySnapshot.findMany({where:{ruleVersionCode:rule},orderBy:{snapshotId:'asc'}}),
      db.periodCloseReceipt.findMany({where:{periodCloseJobId:{in:jobs.map(row=>row.periodCloseJobId)}},orderBy:{periodCloseJobId:'asc'}}),
      db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}}),
      db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}}),
      db.reservoirLedgerEffect.findMany({where:{ruleVersionCode:rule},orderBy:{reservoirLedgerEffectId:'asc'}}),
      db.bonusCalculationEvidence.findMany({where:{ruleVersionCode:rule},orderBy:{bonusCalculationEvidenceId:'asc'}}),
      db.bonusAwardLifecycleEvent.findMany({where:{bonusAwardId:{in:awards.map(row=>row.bonusAwardId)}},orderBy:{lifecycleEventId:'asc'}}),
      db.globalPoolAward.findMany({where:{globalPoolSettlementId:{in:globals.map(row=>row.globalPoolSettlementId)}},orderBy:{globalPoolAwardId:'asc'}}),
      db.qualificationGlobalRankHistory.findMany({where:{ruleVersionCode:rule},orderBy:{qualificationGlobalRankHistoryId:'asc'}}),
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
  const cases=(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'] as const).flatMap(kind=>(['BEFORE_SEAL','AFTER_COMMIT'] as const).flatMap(boundary=>[false,true].map(funded=>[kind,boundary,funded] as const)));
  it.each(cases)('recovers %s Worker delivery killed at %s (funded=%s)',async(kind,boundary,funded)=>{
    const job=await fixture(kind,funded),before=await state(job.ruleVersionCode);
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
    expect(envelope.inputs.totalGpv).toBe(funded?'200':'0');
    expect(await db.historicalReplaySnapshot.count({where:{ruleVersionCode:job.ruleVersionCode,kind:'GPV'}})).toBe(funded?2:0);
    if(kind==='GLOBAL'){
      const awards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:receipt.sourceId}});
      expect(awards.map(row=>row.payableAmount.toString())).toEqual(funded?['4']:[]);
      const settlement=await db.globalPoolSettlement.findUniqueOrThrow({where:{globalPoolSettlementId:receipt.sourceId}});
      expect(settlement.undistributedAmount.toString()).toBe(funded?'6':'0');
      if(funded)expect((await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:receipt.sourceId}})).map(row=>row.amount.toString())).toEqual(['6']);
    }else{
      const awards=await db.bonusAward.findMany({where:{settlementBatchId:receipt.sourceId},orderBy:{bonusAwardId:'asc'}});
      expect(awards.map(row=>row.payableAmount.toString())).toEqual(!funded?[]:kind==='REFERRAL_K0'?['15','15']:kind==='BINARY_K1'?['10']:['1']);
      expect(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:{in:awards.map(row=>row.bonusAwardId)}}})).toBe(awards.length*2);
      if(funded&&kind==='MATCHING_K2'){
        const source=await db.bonusAward.findUniqueOrThrow({where:{bonusAwardId:awards[0].sourceAwardId!}});
        expect(source.awardType).toBe('BINARY');expect(source.payableAmount.toString()).toBe('10');
        expect(envelope.evidence.matchingSources).toEqual([expect.objectContaining({sourceAwardId:source.bonusAwardId})]);
      }
    }
    const done=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}});
    expect(done.processStatus).toBe('PROCESSED');expect(done.attemptCount).toBe(boundary==='BEFORE_SEAL'?2:1);
    if(committed)expect(await state(job.ruleVersionCode)).toEqual(committed);
    const recovered=await state(job.ruleVersionCode);
    expect(await child(job.periodCloseJobId,'ONCE')).toBe(true);
    expect(await state(job.ruleVersionCode)).toEqual(recovered);
    expect(await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}})).toEqual(done);
  },90000);
});
