import {PrismaClient,Prisma} from '@prisma/client';
import {verifyReplayEnvelope} from '@ucell/database';
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
  async function fixture(kind:Kind){
    const rule=`TEST_CLOSE_${randomUUID()}`;
    const parameters:Array<[string,string,Prisma.InputJsonValue]>=[
      ['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['pool.binary.rate','*','0.2'],['binary.pair.rate','*','0.1'],
      ['settlement.timezone',kind,'UTC'],['settlement.period',kind,{unit:'WEEK',count:1,anchorLocal:'1891-01-01T00:00:00'}],
      ['settlement.cut_off',kind,{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_ONLY'}],
    ];
    for(const [parameterCode,scopeKey,valueJson] of parameters)await db.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01T00:00:00Z')}});
    return rule;
  }
  function settle(client:any,kind:Kind,rule:string){
    const rules=new RuntimeRuleService(client),query=new BonusQueryService(client),calendar=new SettlementCalendarService(client);
    return kind==='REFERRAL_K0'?new ReferralBonusService(client,rules,query,calendar).settle(start,end,rule):new BinaryBonusService(client,rules,query,calendar).settleBinary(start,end,rule);
  }
  function instrument(wrap:(tx:Prisma.TransactionClient)=>any){
    return new Proxy(db,{get(target,key){
      return key==='$transaction'?(work:any,options:any)=>target.$transaction(tx=>work(wrap(tx)),options):Reflect.get(target,key);
    }});
  }
  async function assertSingle(kind:Kind,rule:string){
    const batches=await db.settlementBatch.findMany({where:{settlementType:kind,periodStart:start,periodEnd:end,ruleVersionCode:rule}});
    expect(batches).toHaveLength(1);expect(batches[0].status).toBe('FINALIZED');
    const snapshots=await db.historicalReplaySnapshot.findMany({where:{kind,sourceId:batches[0].settlementBatchId}});
    expect(snapshots).toHaveLength(1);expect(verifyReplayEnvelope(snapshots[0])).toMatchObject({sourceId:batches[0].settlementBatchId,kind,recipients:[]});
    expect(batches[0].totalGpv.toString()).toBe('0');
    expect(await db.bonusAward.count({where:{settlementBatchId:batches[0].settlementBatchId}})).toBe(0);
    return {batch:batches[0],snapshot:snapshots[0]};
  }
  it.each(['REFERRAL_K0','BINARY_K1'] as const)('retries concurrent %s requests using a fresh client without duplicate finalization',async kind=>{
    const rule=await fixture(kind);
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
  it.each(['REFERRAL_K0','BINARY_K1'] as const)('rolls back %s finalization if sealing fails, then retries from a fresh client',async kind=>{
    const rule=await fixture(kind),injected='INJECTED_BEFORE_SEALED_SNAPSHOT';
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
    expect(await db.historicalReplaySnapshot.count({where:{ruleVersionCode:rule}})).toBe(0);
    const fresh=new PrismaClient({datasources:{db:{url}}});
    try{await settle(fresh,kind,rule);}finally{await fresh.$disconnect();}
    await assertSingle(kind,rule);
  },30000);
});
