import {PrismaClient,Prisma} from '@prisma/client';
import {sealGpvEvent,verifyReplayEnvelope} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {ReferralBonusService} from '../src/modules/bonus/referral-bonus.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {SettlementCalendarService} from '../src/modules/settlement/settlement-calendar.service';

type Kind='REFERRAL_K0'|'BINARY_K1';
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
    for(const [parameterCode,scopeKey,valueJson] of parameters)await db.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01T00:00:00Z'),effectiveTo:new Date(period.end.getTime()+86400000)}});
    if(funded)await db.$transaction(async tx=>{
      const effectiveFrom=new Date(period.start.getTime()-86400000),effectiveTo=new Date(period.end.getTime()+86400000),at=new Date(period.start.getTime()+86400000);
      const person=await tx.person.create({data:{legalName:'SYNTHETIC CONCURRENT SETTLEMENT'}}),qualifications=[];
      for(let i=0;i<3;i++){
        const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});qualifications.push(q);
        await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom,effectiveTo,sourceType:'TEST_CLOSE'}});
        await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom,effectiveTo,sourceType:'TEST_CLOSE'}});
        if(i===0)await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:effectiveFrom,activeTo:effectiveTo,sourceType:'TEST_CLOSE',ruleVersionCode:rule}});
        else{
          await tx.binaryPlacement.create({data:{parentQualificationId:qualifications[0].qualificationId,childQualificationId:q.qualificationId,side:i===1?'LEFT':'RIGHT',effectiveFrom,effectiveTo}});
          await tx.sponsorRelationship.create({data:{sponsorQualificationId:qualifications[0].qualificationId,childQualificationId:q.qualificationId,sponsorSequenceNo:i,effectiveFrom,effectiveTo}});
        }
      }
      const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Concurrent source',currentPrice:100}});
      for(const q of qualifications.slice(1)){
        const order=await tx.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:rule}});
        const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'Concurrent source',quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
        const event=await tx.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode:rule,occurredAt:at,correlationId:randomUUID()}});
        await sealGpvEvent(tx,event);
      }
    },{timeout:30000});
    return rule;
  }
  function settle(client:any,kind:Kind,rule:string){
    const {start,end}=periods.get(rule)!;
    const rules=new RuntimeRuleService(client),query=new BonusQueryService(client),calendar=new SettlementCalendarService(client);
    return kind==='REFERRAL_K0'?new ReferralBonusService(client,rules,query,calendar).settle(start,end,rule):new BinaryBonusService(client,rules,query,calendar).settleBinary(start,end,rule);
  }
  function instrument(wrap:(tx:Prisma.TransactionClient)=>any){
    return new Proxy(db,{get(target,key){
      return key==='$transaction'?(work:any,options:any)=>target.$transaction(tx=>work(wrap(tx)),options):Reflect.get(target,key);
    }});
  }
  async function assertSingle(kind:Kind,rule:string){
    const {start,end,funded}=periods.get(rule)!;
    const batches=await db.settlementBatch.findMany({where:{settlementType:kind,periodStart:start,periodEnd:end,ruleVersionCode:rule}});
    expect(batches).toHaveLength(1);expect(batches[0].status).toBe('FINALIZED');
    const snapshots=await db.historicalReplaySnapshot.findMany({where:{kind,sourceId:batches[0].settlementBatchId}});
    expect(snapshots).toHaveLength(1);const envelope=verifyReplayEnvelope(snapshots[0]);
    expect(envelope).toMatchObject({sourceId:batches[0].settlementBatchId,kind});
    expect(batches[0].totalGpv.toString()).toBe(funded?'200':'0');
    const awards=await db.bonusAward.findMany({where:{settlementBatchId:batches[0].settlementBatchId},orderBy:{bonusAwardId:'asc'}});
    expect(awards).toHaveLength(funded?(kind==='REFERRAL_K0'?2:1):0);expect(envelope.recipients).toHaveLength(awards.length);
    expect(awards.map(row=>row.payableAmount.toString())).toEqual(funded?(kind==='REFERRAL_K0'?['15','15']:['10']):[]);
    const decisions=await db.bonusCalculationEvidence.findMany({where:{settlementBatchId:batches[0].settlementBatchId},orderBy:{bonusCalculationEvidenceId:'asc'}});
    expect(decisions).toHaveLength(funded&&kind==='BINARY_K1'?2:0);
    expect(envelope.evidence.eligibilityEvidence).toEqual(JSON.parse(JSON.stringify(decisions)));
    const carries=await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{qualificationId:'asc'}});
    expect(carries).toHaveLength(funded&&kind==='BINARY_K1'?3:0);
    const lifecycle=await db.bonusAwardLifecycleEvent.findMany({where:{bonusAwardId:{in:awards.map(row=>row.bonusAwardId)}},orderBy:{lifecycleEventId:'asc'}});
    expect(lifecycle).toHaveLength(awards.length*2);
    return {batch:batches[0],snapshot:snapshots[0],awards,decisions,carries,lifecycle};
  }
  const cases=[['REFERRAL_K0',false],['BINARY_K1',false],['REFERRAL_K0',true],['BINARY_K1',true]] as const;
  it.each(cases)('retries concurrent %s requests (funded=%s) without duplicate economic rows',async(kind,funded)=>{
    const rule=await fixture(kind,funded);
    let arrived=0,release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const concurrent=instrument(tx=>new Proxy(tx,{get(target,key){
      if(key!=='settlementBatch')return Reflect.get(target,key);
      return new Proxy(target.settlementBatch,{get(delegate,method){
        if(method!=='findUnique')return Reflect.get(delegate,method);
        return async(args:any)=>{const result=await delegate.findUnique(args);arrived++;if(arrived===2)release();await gate;return result;};
      }});
    }}));
    // Both transactions read the absent batch before either is allowed to create it.
    const outcomes=await Promise.allSettled([settle(concurrent,kind,rule),settle(concurrent,kind,rule)]);
    expect(arrived).toBe(2);expect(outcomes.filter(row=>row.status==='fulfilled')).toHaveLength(1);
    for(const outcome of outcomes)if(outcome.status==='rejected')expect(['P2002','P2034']).toContain(outcome.reason.code);
    const original=await assertSingle(kind,rule);
    const fresh=new PrismaClient({datasources:{db:{url}}});
    try{expect(await settle(fresh,kind,rule)).toEqual(original.batch);}finally{await fresh.$disconnect();}
    expect(await assertSingle(kind,rule)).toEqual(original);
  },30000);
  it.each(cases)('rolls back %s economic rows (funded=%s) if sealing fails, then retries',async(kind,funded)=>{
    const rule=await fixture(kind,funded),injected='INJECTED_BEFORE_SEALED_SNAPSHOT';
    let reached=false;
    const failing=instrument(tx=>new Proxy(tx,{get(target,key){
      if(key!=='historicalReplaySnapshot')return Reflect.get(target,key);
      return new Proxy(target.historicalReplaySnapshot,{get(delegate,method){
        if(method!=='create')return Reflect.get(delegate,method);
        return async()=>{reached=true;throw new Error(injected);};
      }});
    }}));
    await expect(settle(failing,kind,rule)).rejects.toThrow(injected);expect(reached).toBe(true);
    expect(await db.settlementBatch.count({where:{ruleVersionCode:rule}})).toBe(0);
    expect(await db.historicalReplaySnapshot.count({where:{ruleVersionCode:rule,kind}})).toBe(0);
    expect(await db.historicalReplaySnapshot.count({where:{ruleVersionCode:rule,kind:'GPV'}})).toBe(funded?2:0);
    expect(await db.bonusAward.count({where:{ruleVersionCode:rule}})).toBe(0);
    expect(await db.bonusCalculationEvidence.count({where:{ruleVersionCode:rule}})).toBe(0);
    expect(await db.binaryCarry.count({where:{ruleVersionCode:rule}})).toBe(0);
    const fresh=new PrismaClient({datasources:{db:{url}}});
    try{await settle(fresh,kind,rule);}finally{await fresh.$disconnect();}
    await assertSingle(kind,rule);
  },30000);
});
