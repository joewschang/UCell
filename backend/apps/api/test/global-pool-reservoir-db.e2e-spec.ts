import { Prisma } from '@ucell/database';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { GlobalPoolPersistence } from '../src/modules/global-pool/global-pool-persistence';

const d=(value:string|number)=>new Prisma.Decimal(value);
function localTestDatabaseUrl(){
  const raw=process.env.GLOBAL_RESERVOIR_TEST_DATABASE_URL??process.env.DATABASE_URL;
  if(!raw) throw new Error('GLOBAL_RESERVOIR_DB_TEST_URL_REQUIRED');
  const url=new URL(raw),database=decodeURIComponent(url.pathname.replace(/^\//,''));
  const isolatedRunner=/^ucell_jest_[0-9a-f]{32}$/.test(database);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||(!database.endsWith('_test')&&!isolatedRunner)){
    throw new Error('GLOBAL_RESERVOIR_DB_TEST_REQUIRES_LOCAL_TEST_DATABASE');
  }
  return raw;
}

describe('Global settlement to Reservoir A database boundary',()=>{
  let db:PrismaClient;
  const persistence=new GlobalPoolPersistence();
  const runOffset=Date.now()%1_000_000_000;
  const periodStart=new Date(Date.UTC(2040,0,1)+runOffset);
  const periodEnd=new Date(periodStart.getTime()+15*24*60*60*1000);
  const input=(settlementId:string,start=periodStart,end=periodEnd)=>({
    settlementId,periodStart:start,periodEnd:end,totalGpv:d(1000),poolRate:d('.05'),poolAvailable:d(50),
    distributedAmount:d(10),undistributedAmount:d(40),ruleVersionCode:'TEST_RESERVOIR_V1',
    parameterSnapshot:{} as Prisma.InputJsonValue,awards:[],
  });
  beforeAll(()=>{db=new PrismaClient({datasources:{db:{url:localTestDatabaseUrl()}}});});
  afterAll(()=>db?.$disconnect());

  it('persists settlement and Reservoir A exactly once under concurrent duplicate delivery',async()=>{
    const ids=[randomUUID(),randomUUID()];
    const outcomes=await Promise.allSettled(ids.map(id=>db.$transaction((tx:Prisma.TransactionClient)=>persistence.persist(tx,input(id)),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})));
    expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    const settlements=await db.globalPoolSettlement.findMany({where:{periodStart,periodEnd,ruleVersionCode:'TEST_RESERVOIR_V1'}});
    expect(settlements).toHaveLength(1);
    const effects=await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:settlements[0].globalPoolSettlementId}});
    expect(effects).toHaveLength(1);
    expect(effects[0].amount.toString()).toBe('40');
    await expect(db.$transaction((tx:Prisma.TransactionClient)=>persistence.persist(tx,input(randomUUID())))).rejects.toMatchObject({code:'P2002'});
    expect(await db.reservoirLedgerEffect.count({where:{sourcePeriodStart:periodStart,sourcePeriodEnd:periodEnd}})).toBe(1);
  });

  it('rolls back settlement and Reservoir effect when a later operation fails',async()=>{
    const start=new Date(periodEnd.getTime()+1),end=new Date(start.getTime()+15*24*60*60*1000),id=randomUUID();
    await expect(db.$transaction(async (tx:Prisma.TransactionClient)=>{await persistence.persist(tx,input(id,start,end));throw new Error('INJECTED_AFTER_RESERVOIR');})).rejects.toThrow('INJECTED_AFTER_RESERVOIR');
    expect(await db.globalPoolSettlement.count({where:{globalPoolSettlementId:id}})).toBe(0);
    expect(await db.reservoirLedgerEffect.count({where:{sourceGlobalSettlementId:id}})).toBe(0);
  });

  it('database rejects mismatched Reservoir source evidence and protects append-only rows',async()=>{
    const settlement=(await db.globalPoolSettlement.findFirstOrThrow({where:{periodStart,periodEnd,ruleVersionCode:'TEST_RESERVOIR_V1'}}));
    await expect(db.reservoirLedgerEffect.create({data:{reservoirCode:'A',effectType:'GLOBAL_UNDISTRIBUTED',sourceGlobalSettlementId:settlement.globalPoolSettlementId,sourcePeriodStart:periodStart,sourcePeriodEnd:periodEnd,amount:d(39),ruleVersionCode:settlement.ruleVersionCode,idempotencyKey:`tampered-source:${randomUUID()}`,evidenceHash:'tampered'}})).rejects.toThrow();
    const effect=await db.reservoirLedgerEffect.findFirstOrThrow({where:{sourceGlobalSettlementId:settlement.globalPoolSettlementId}});
    await expect(db.reservoirLedgerEffect.update({where:{reservoirLedgerEffectId:effect.reservoirLedgerEffectId},data:{evidenceHash:'tampered'}})).rejects.toThrow();
  });
});
