import {PrismaClient,Prisma} from '@prisma/client';
import {sealGpvEvent,verifyReplayEnvelope,enqueuePeriodCloseJob,claimPeriodCloseJob,processPeriodCloseJob} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {executePeriodClose} from '@ucell/settlement';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {ReferralBonusService} from '../src/modules/bonus/referral-bonus.service';
import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {SettlementCalendarService} from '../src/modules/settlement/settlement-calendar.service';

type Kind='REFERRAL_K0'|'BINARY_K1'|'MATCHING_K2'|'GLOBAL';
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('period settlement concurrent delivery and retry transaction boundary',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());
  const start=new Date('1891-01-01T00:00:00Z'),end=new Date('1891-01-08T00:00:00Z');
  const periods=new Map<string,{start:Date;end:Date;funded:boolean}>();
  let sequence=0;
  async function fixture(kind:Kind,funded=false){
    const rule=`TEST_CLOSE_${randomUUID()}`;
    const period=funded?{start:new Date(Date.UTC(2020,0,1+(++sequence)*14)),end:new Date(Date.UTC(2020,0,8+sequence*14)),funded}:{start,end,funded};
    periods.set(rule,period);
    const parameters:Array<[string,string,Prisma.InputJsonValue]>=[
      ['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['pool.binary.rate','*','0.2'],['binary.pair.rate','*','0.1'],
      ['binary.weekly.cap','STARTER','10000'],['referral.g1.rate','STARTER','0.15'],
      ['settlement.timezone',kind,'UTC'],['settlement.period',kind,{unit:'WEEK',count:1,anchorLocal:period.start.toISOString().slice(0,19)}],
      ['settlement.cut_off',kind,{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
    ];
    if(kind==='MATCHING_K2')parameters.push(
      ['pool.matching.rate','*','0.2'],['matching.rate','1','0.1'],
      ['settlement.timezone','BINARY_K1','UTC'],['settlement.period','BINARY_K1',{unit:'WEEK',count:1,anchorLocal:period.start.toISOString().slice(0,19)}],
      ['settlement.cut_off','BINARY_K1',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
    );
    if(kind==='GLOBAL'){
      parameters.push(['pool.global.rate','*','0.05']);
      for(const rank of ['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN']){
        parameters.push(['global.rank.weak_threshold',rank,rank==='NEW_STAR'?'100':'1000']);
        parameters.push(['global.rank.pool_rate',rank,rank==='NEW_STAR'?'0.02':'0.0075']);
      }
    }
    for(const [parameterCode,scopeKey,valueJson] of parameters)await db.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01T00:00:00Z'),effectiveTo:new Date(period.end.getTime()+86400000)}});
    if(funded)await db.$transaction(async tx=>{
      const effectiveFrom=new Date(period.start.getTime()-86400000),effectiveTo=new Date(period.end.getTime()+86400000),at=new Date(period.start.getTime()+86400000);
      const person=await tx.person.create({data:{legalName:'SYNTHETIC CONCURRENT SETTLEMENT'}}),qualifications=[];
      for(let i=0;i<(kind==='MATCHING_K2'?4:3);i++){
        const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});qualifications.push(q);
        await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom,effectiveTo,sourceType:'TEST_CLOSE'}});
        await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom,effectiveTo,sourceType:'TEST_CLOSE'}});
        if(i===0||i===3)await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:effectiveFrom,activeTo:effectiveTo,sourceType:'TEST_CLOSE',ruleVersionCode:rule}});
        else{
          await tx.binaryPlacement.create({data:{parentQualificationId:qualifications[0].qualificationId,childQualificationId:q.qualificationId,side:i===1?'LEFT':'RIGHT',effectiveFrom,effectiveTo:kind==='GLOBAL'?null:effectiveTo}});
          await tx.sponsorRelationship.create({data:{sponsorQualificationId:qualifications[0].qualificationId,childQualificationId:q.qualificationId,sponsorSequenceNo:i,effectiveFrom,effectiveTo}});
        }
        if(i===3)await tx.sponsorRelationship.create({data:{sponsorQualificationId:q.qualificationId,childQualificationId:qualifications[0].qualificationId,sponsorSequenceNo:1,effectiveFrom,effectiveTo}});
      }
      const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Concurrent source',currentPrice:100}});
      for(const q of qualifications.slice(1,3)){
        const order=await tx.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:rule}});
        const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'Concurrent source',quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
        const event=await tx.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:rule,occurredAt:at,correlationId:randomUUID()}});
        await sealGpvEvent(tx,event);
      }
    },{timeout:30000});
    if(kind==='MATCHING_K2')await settle(db,'BINARY_K1',rule);
    return rule;
  }
  function settle(client:any,kind:Kind,rule:string){
    const {start,end}=periods.get(rule)!;
    const rules=new RuntimeRuleService(client),query=new BonusQueryService(client),calendar=new SettlementCalendarService(client);
    if(kind==='GLOBAL')return new GlobalPoolService(client,rules,query,calendar,new GlobalPoolPersistence()).evaluateAndSettle(start,end,rule);
    if(kind==='REFERRAL_K0')return new ReferralBonusService(client,rules,query,calendar).settle(start,end,rule);
    const binary=new BinaryBonusService(client,rules,query,calendar);
    return kind==='MATCHING_K2'?binary.settleMatching(start,end,rule):binary.settleBinary(start,end,rule);
  }
  function instrument(wrap:(tx:Prisma.TransactionClient)=>any){
    return new Proxy(db,{get(target,key){
      return key==='$transaction'?(work:any,options:any)=>target.$transaction(tx=>work(wrap(tx)),options):Reflect.get(target,key);
    }});
  }
  async function assertSingle(kind:Kind,rule:string){
    const {start,end,funded}=periods.get(rule)!;
    if(kind==='GLOBAL'){
      const batches=await db.globalPoolSettlement.findMany({where:{periodStart:start,periodEnd:end,ruleVersionCode:rule}});
      expect(batches).toHaveLength(1);const batch=batches[0];
      expect(batch.totalGpv.toString()).toBe('200');expect(batch.distributedAmount.toString()).toBe('4');expect(batch.undistributedAmount.toString()).toBe('6');
      const awards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:batch.globalPoolSettlementId}});
      expect(awards).toHaveLength(1);expect(awards[0].payableAmount.toString()).toBe('4');
      const snapshots=await db.historicalReplaySnapshot.findMany({where:{kind,sourceId:batch.globalPoolSettlementId}});
      expect(snapshots).toHaveLength(1);const snapshot=snapshots[0],envelope=verifyReplayEnvelope(snapshot);
      expect(envelope.recipients).toHaveLength(1);expect(envelope.evidence.globalEligibilityDecisions.filter((row:any)=>row.eligible)).toHaveLength(1);
      const reservoir=await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:batch.globalPoolSettlementId}});
      expect(reservoir).toHaveLength(1);expect(reservoir[0].amount.toString()).toBe('6');
      return {batch,snapshot,awards,reservoir};
    }
    const batches=await db.settlementBatch.findMany({where:{settlementType:kind,periodStart:start,periodEnd:end,ruleVersionCode:rule}});
    expect(batches).toHaveLength(1);expect(batches[0].status).toBe('FINALIZED');
    const snapshots=await db.historicalReplaySnapshot.findMany({where:{kind,sourceId:batches[0].settlementBatchId}});
    expect(snapshots).toHaveLength(1);const envelope=verifyReplayEnvelope(snapshots[0]);
    expect(envelope).toMatchObject({sourceId:batches[0].settlementBatchId,kind});
    expect(batches[0].totalGpv.toString()).toBe(funded?'200':'0');
    const awards=await db.bonusAward.findMany({where:{settlementBatchId:batches[0].settlementBatchId},orderBy:{bonusAwardId:'asc'}});
    expect(awards).toHaveLength(funded?(kind==='REFERRAL_K0'?2:1):0);expect(envelope.recipients).toHaveLength(awards.length);
    expect(awards.map(row=>row.payableAmount.toString())).toEqual(funded?(kind==='REFERRAL_K0'?['15','15']:kind==='MATCHING_K2'?['1']:['10']):[]);
    if(kind==='MATCHING_K2'){
      const source=await db.bonusAward.findUniqueOrThrow({where:{bonusAwardId:awards[0].sourceAwardId!}});
      expect(source.awardType).toBe('BINARY');expect(source.payableAmount.toString()).toBe('10');
      expect(envelope.evidence.matchingSources).toEqual([expect.objectContaining({sourceAwardId:source.bonusAwardId})]);
    }
    const decisions=await db.bonusCalculationEvidence.findMany({where:{settlementBatchId:batches[0].settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}});
    expect(decisions).toHaveLength(funded&&kind==='BINARY_K1'?2:0);
    expect(envelope.evidence.eligibilityEvidence).toEqual(JSON.parse(JSON.stringify(decisions)));
    const carries=await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{qualificationId:'asc'}});
    expect(carries).toHaveLength(kind==='MATCHING_K2'?4:funded&&kind==='BINARY_K1'?3:0);
    const lifecycle=await db.bonusAwardLifecycleEvent.findMany({where:{bonusAwardId:{in:awards.map(row=>row.bonusAwardId)}},orderBy:{lifecycleEventId:'asc'}});
    expect(lifecycle).toHaveLength(awards.length*2);
    return {batch:batches[0],snapshot:snapshots[0],awards,decisions,carries,lifecycle};
  }
  async function economicState(rule:string){
    const awards=await db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}});
    const globals=await db.globalPoolSettlement.findMany({where:{ruleVersionCode:rule},orderBy:{globalPoolSettlementId:'asc'}});
    return {awards,globals,rows:await Promise.all([
      db.settlementBatch.findMany({where:{ruleVersionCode:rule},orderBy:{settlementBatchId:'asc'}}),
      db.historicalReplaySnapshot.findMany({where:{ruleVersionCode:rule},orderBy:{snapshotId:'asc'}}),
      db.bonusCalculationEvidence.findMany({where:{ruleVersionCode:rule},orderBy:{bonusCalculationEvidenceId:'asc'}}),
      db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}}),
      db.bonusAwardLifecycleEvent.findMany({where:{bonusAwardId:{in:awards.map(row=>row.bonusAwardId)}},orderBy:{lifecycleEventId:'asc'}}),
      db.globalPoolAward.findMany({where:{globalPoolSettlementId:{in:globals.map(row=>row.globalPoolSettlementId)}},orderBy:{globalPoolAwardId:'asc'}}),
      db.reservoirLedgerEffect.findMany({where:{ruleVersionCode:rule},orderBy:{reservoirLedgerEffectId:'asc'}}),
      db.qualificationGlobalRankHistory.findMany({where:{ruleVersionCode:rule},orderBy:{qualificationGlobalRankHistoryId:'asc'}}),
    ])};
  }
  const cases=[['REFERRAL_K0',false],['BINARY_K1',false],['REFERRAL_K0',true],['BINARY_K1',true],['MATCHING_K2',true],['GLOBAL',true]] as const;
  it.each(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'] as const)('commits funded %s economic rows with its durable job receipt',async kind=>{
    const rule=await fixture(kind,true),period=periods.get(rule)!;
    async function admit(type:Kind,prerequisiteIds:string[]=[]){
      return enqueuePeriodCloseJob(db,{kind:type,periodStart:period.start,periodEnd:period.end,ruleVersionCode:rule,prerequisiteIds,requestedBy:'TEST_FINANCE',approvalReference:'TEST_CLOSE'},tx=>new SettlementCalendarService(db as any).captureForPeriod(tx,period.start,period.end,type,rule));
    }
    async function run(job:any){
      return processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,executePeriodClose);
    }
    const prerequisites:string[]=[];
    if(kind==='MATCHING_K2'){
      const binary=await admit('BINARY_K1');await run(binary);prerequisites.push(binary.periodCloseJobId);
    }
    const job=await admit(kind,prerequisites),receipt=await run(job);
    const result=await assertSingle(kind,rule);
    expect(receipt).toMatchObject({periodCloseJobId:job.periodCloseJobId,snapshotId:result.snapshot.snapshotId});
    const before=await economicState(rule);
    expect(await claimPeriodCloseJob(db,job.periodCloseJobId)).toBeNull();
    expect(await economicState(rule)).toEqual(before);
  },30000);
  async function runProcess(kind:Kind,rule:string,boundary:'BEFORE_SEAL'|'AFTER_COMMIT'|'COMPLETE'){
    const period=periods.get(rule)!;
    const child=spawn(process.execPath,['-r',require.resolve('ts-node/register/transpile-only'),join(__dirname,'helpers/settlement-process.ts'),kind,rule,period.start.toISOString(),period.end.toISOString(),boundary],{
      env:{...process.env,TS_NODE_PROJECT:join(__dirname,'../tsconfig.json')},
      stdio:['ignore','ignore','pipe','ipc'],windowsHide:true,
    });
    let stderr='',ready=false,completed=false,backendPid:number|undefined;
    child.stderr!.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-2000);});
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Settlement child timed out'));},20000);
      child.on('error',error=>{clearTimeout(timeout);reject(error);});
      child.on('message',(message:any)=>{
        if(message.type==='ERROR'){child.kill('SIGKILL');clearTimeout(timeout);reject(new Error(message.message));}
        if(message.type==='COMPLETE')completed=true;
        if(message.type==='READY'){
          ready=message.boundary===boundary;backendPid=message.backendPid;
          child.kill('SIGKILL');
        }
      });
      child.on('exit',(code,signal)=>{
        clearTimeout(timeout);
        if(boundary==='COMPLETE'?completed&&code===0:ready&&child.killed&&(signal==='SIGKILL'||code!==0))resolve();
        else reject(new Error(`Unexpected settlement child exit: ${code}/${signal}: ${stderr}`));
      });
    });
    if(boundary!=='COMPLETE'){
      expect(backendPid).toEqual(expect.any(Number));
      // Wait for PostgreSQL to observe socket loss, not merely the OS exit event.
      for(let attempt=0;attempt<100;attempt++){
        const sessions=await db.$queryRaw<Array<{pid:number}>>`SELECT pid FROM pg_stat_activity WHERE pid=${backendPid!} AND datname=current_database()`;
        if(sessions.length===0)return;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw new Error('Terminated settlement database session remained open');
    }
  }
  const crashCases=(['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'] as const).flatMap(kind=>(['BEFORE_SEAL','AFTER_COMMIT'] as const).map(boundary=>[kind,boundary] as const));
  it.each(crashCases)('recovers %s after a real process kill at %s',async(kind,boundary)=>{
    const rule=await fixture(kind,true),before=await economicState(rule);
    await runProcess(kind,rule,boundary);
    if(boundary==='BEFORE_SEAL')expect(await economicState(rule)).toEqual(before);
    else await assertSingle(kind,rule);
    const committed=boundary==='AFTER_COMMIT'?await economicState(rule):null;
    await runProcess(kind,rule,'COMPLETE');
    await assertSingle(kind,rule);
    if(committed)expect(await economicState(rule)).toEqual(committed);
    const recovered=await economicState(rule);
    await runProcess(kind,rule,'COMPLETE');
    expect(await economicState(rule)).toEqual(recovered);
  },60000);
  it.each(cases)('retries concurrent %s requests (funded=%s) without duplicate economic rows',async(kind,funded)=>{
    const rule=await fixture(kind,funded);
    let arrived=0,release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const concurrent=instrument(tx=>new Proxy(tx,{get(target,key){
      if(key!==(kind==='GLOBAL'?'globalPoolSettlement':'settlementBatch'))return Reflect.get(target,key);
      return new Proxy(Reflect.get(target,key),{get(delegate,method){
        if(method!=='findUnique')return Reflect.get(delegate,method);
        return async(args:any)=>{const result=await (delegate as any).findUnique(args);if(result||(kind!=='GLOBAL'&&args.where.settlementType_periodStart_periodEnd_ruleVersionCode?.settlementType!==kind))return result;arrived++;if(arrived===2)release();await gate;return result;};
      }});
    }}));
    // Both transactions read the absent batch before either is allowed to create it.
    const outcomes=await Promise.allSettled([settle(concurrent,kind,rule),settle(concurrent,kind,rule)]);
    expect(arrived).toBe(2);expect(outcomes.filter(row=>row.status==='fulfilled')).toHaveLength(kind==='GLOBAL'?2:1);
    for(const outcome of outcomes)if(outcome.status==='rejected')expect(['P2002','P2034']).toContain(outcome.reason.code);
    const original=await assertSingle(kind,rule);
    for(const outcome of outcomes)if(outcome.status==='fulfilled')expect(outcome.value).toEqual(original.batch);
    const originalState=await economicState(rule);
    const fresh=new PrismaClient({datasources:{db:{url}}});
    try{expect(await settle(fresh,kind,rule)).toEqual(original.batch);}finally{await fresh.$disconnect();}
    expect(await assertSingle(kind,rule)).toEqual(original);
    expect(await economicState(rule)).toEqual(originalState);
  },30000);
  it.each(cases)('rolls back %s economic rows (funded=%s) if sealing fails, then retries',async(kind,funded)=>{
    const rule=await fixture(kind,funded),injected='INJECTED_BEFORE_SEALED_SNAPSHOT';
    const before=await economicState(rule);
    let reached=false;
    const failing=instrument(tx=>new Proxy(tx,{get(target,key){
      if(key!=='historicalReplaySnapshot')return Reflect.get(target,key);
      return new Proxy(target.historicalReplaySnapshot,{get(delegate,method){
        if(method!=='create')return Reflect.get(delegate,method);
        return async()=>{reached=true;throw new Error(injected);};
      }});
    }}));
    await expect(settle(failing,kind,rule)).rejects.toThrow(injected);expect(reached).toBe(true);
    expect(await economicState(rule)).toEqual(before);
    expect(await db.historicalReplaySnapshot.count({where:{ruleVersionCode:rule,kind}})).toBe(0);
    expect(await db.historicalReplaySnapshot.count({where:{ruleVersionCode:rule,kind:'GPV'}})).toBe(funded?2:0);
    const fresh=new PrismaClient({datasources:{db:{url}}});
    try{await settle(fresh,kind,rule);}finally{await fresh.$disconnect();}
    await assertSingle(kind,rule);
  },30000);
});
