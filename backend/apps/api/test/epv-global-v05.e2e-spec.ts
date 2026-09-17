import { captureParameters, historicalMonthlyEntitlements, Prisma } from '@ucell/database';
import { GlobalPoolService } from '../src/modules/global-pool/global-pool.service';
import { GlobalPoolPersistence } from '../src/modules/global-pool/global-pool-persistence';
import { epv,d } from './phase2-fixtures';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
let evidence:any[];
beforeAll(()=>{
 const root=resolve(__dirname,'../../../..'),directory=mkdtempSync(join(tmpdir(),'ucell-epv-'));
 try{
  const file=join(directory,'evidence.json');
  execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public',PHASE2_DB_EVIDENCE_PATH:file},timeout:30000});
  const run=JSON.parse(readFileSync(file,'utf8'));expect(run.result).toBe('PASS');evidence=run.results;
 }finally{rmSync(directory,{recursive:true,force:true});}
},30000);
function actual(label:string){const row=evidence.find(item=>item.label===label);expect(row).toBeDefined();expect(row.result).toBe('PASS');expect(row.actual).toEqual(row.expected);return row.actual;}
const levels=['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'] as const;
async function globalHarness(input:{total?:string;weak?:Record<string,string>;active?:Record<string,boolean>}={}){
 const parameters=[['pool.global.rate','*','0.05'],['pool.welfare.rate','*','0.02'],
  ...['0.015','0.010','0.005','0.005','0.015'].map((value,i)=>['global.rank.pool_rate',levels[i],value]),
  ...['300000','600000','1000000','2000000','4000000'].map((value,i)=>['global.rank.weak_threshold',levels[i],value])]
  .map(([parameterCode,scopeKey,valueJson],i)=>({runtimeRuleParameterId:String(i),parameterCode,scopeKey,valueJson,effectiveFrom:new Date('2019-01-01'),effectiveTo:null}));
 const snapshot=await captureParameters({runtimeRuleParameter:{findMany:async()=>parameters}} as any,new Date('2020-02-01'),'TEST_ONLY');
 const qualifications=Object.keys(input.weak??{}).map(qualificationId=>({qualificationId})),ranks=new Set<string>(),awards:any[]=[],settlements:any[]=[],reservoir:any[]=[],accruals:any[]=[];
 const tx:any={
  qualification:{findMany:jest.fn(async()=>qualifications)},
  qualificationGlobalRankHistory:{
   upsert:jest.fn(async({where,create}:any)=>{ranks.add(`${where.qualificationId_rankCode.qualificationId}:${where.qualificationId_rankCode.rankCode}`);return create;}),
   findUnique:jest.fn(async({where}:any)=>ranks.has(`${where.qualificationId_rankCode.qualificationId}:${where.qualificationId_rankCode.rankCode}`)?where.qualificationId_rankCode:null),
  },
  globalPoolSettlement:{findUnique:jest.fn(async()=>null),create:jest.fn(async({data}:any)=>{const row={...data};settlements.push(row);return row;}),update:jest.fn(async({data}:any)=>({...settlements.at(-1),...data}))},
  globalPoolAward:{create:jest.fn(async({data}:any)=>{awards.push(data);return data;})},
  reservoirLedgerEffect:{
   create:jest.fn(async({data}:any)=>{const row={...data,createdAt:new Date()};reservoir.push(row);return row;}),
   findUnique:jest.fn(async()=>reservoir.at(-1)??null),
  },
  bonusAward:{create:jest.fn()},payable:{create:jest.fn()},ledgerEntry:{create:jest.fn()},
  welfarePoolAccrual:{findUnique:jest.fn(async()=>null),create:jest.fn(async({data}:any)=>{accruals.push(data);return data;})},
 };
 const query={totalGpv:jest.fn(async()=>new Prisma.Decimal(input.total??'10000000')),isActiveAt:jest.fn(async(_tx:any,qid:string)=>input.active?.[qid]??true)};
 const service=new GlobalPoolService({$transaction:async(work:any)=>work(tx)} as any,{} as any,query as any,{captureForPeriod:async()=>snapshot} as any,new GlobalPoolPersistence());
 jest.spyOn(service,'weakSidePv').mockImplementation(async(_tx:any,qid:string)=>new Prisma.Decimal(input.weak?.[qid]??0));
 return {service,tx,snapshot,ranks,awards,settlements,reservoir,accruals};
}
describe('v0.5 EPV', () => {
  it('REPURCHASE 4800 => excess 2800 x 60% = 1680 EPV',()=>{expect(historicalMonthlyEntitlements([epv()],new Map([['order',d(4800)]])).get('order')!.toString()).toBe('1680');});
  it('EPV self share = 50% = 840 when Active',()=>expect(actual('original Active EPV self entitlement')).toBe('840'));
  it('EPV Sponsor G1-G5 each 6% when Active',()=>{for(let generation=1;generation<=5;generation++)expect(actual('Active historical EPV Sponsor G'+generation)).toBe('100.8');expect(actual('original inactive EPV Sponsor generation stays zero')).toBe('0');});
  it('EPV does not use Binary tree',()=>expect(actual('Binary-only historical EPV ancestor gets no award')).toBe(0));
  it('order without eligible ConsumptionRecognition does not enter the EPV accumulator',()=>{const recognized=new Map<string,Prisma.Decimal>();expect(historicalMonthlyEntitlements([],recognized).size).toBe(0);expect(recognized.has('order')).toBe(false);});
});

describe('v0.5 Global/Welfare', () => {
  const start=new Date('2020-01-01'),end=new Date('2020-02-01');
  it('global pool is 5% of period GPV',async()=>{const h=await globalHarness({total:'1000'});const row=await h.service.evaluateAndSettle(start,end,'TEST_ONLY');expect(row.poolRate.toString()).toBe('0.05');expect(row.poolAvailable.toString()).toBe('50');});
  it('weak thresholds are 300k/600k/1m/2m/4m',async()=>{const h=await globalHarness({weak:{q:'4000000'}});await h.service.evaluateAndSettle(start,end,'TEST_ONLY');expect([...h.ranks].map(x=>x.split(':')[1])).toEqual([...levels]);});
  it('rank achievement never downgrades',async()=>{const h=await globalHarness({weak:{q:'4000000'}});await h.service.evaluateAndSettle(start,end,'TEST_ONLY');(h.service.weakSidePv as jest.Mock).mockResolvedValue(new Prisma.Decimal(0));await h.service.evaluateAndSettle(end,new Date('2020-03-01'),'TEST_ONLY');expect(h.ranks.size).toBe(5);expect(h.tx.qualificationGlobalRankHistory.upsert).toHaveBeenCalledTimes(5);});
  it('monthly payout requires Active and current-month weak side threshold',async()=>{const h=await globalHarness({weak:{inactive:'4000000',below:'299999'},active:{inactive:false,below:true}});await h.service.evaluateAndSettle(start,end,'TEST_ONLY');expect(h.awards).toEqual([]);});
  it('passed levels are cumulative',async()=>{const h=await globalHarness({weak:{q:'1000000'}});await h.service.evaluateAndSettle(start,end,'TEST_ONLY');expect([...h.ranks]).toEqual(['q:NEW_STAR','q:EXCELLENCE','q:GLORY']);expect(h.awards.map(row=>row.rankLevel)).toEqual(['NEW_STAR','EXCELLENCE','GLORY']);});
  it('v3 replacement for legacy roll-up: empty rank slices remain undistributed',async()=>{
    const h=await globalHarness({total:'1000'});
    const row=await h.service.evaluateAndSettle(start,end,'TEST_ONLY');
    expect(row.distributedAmount.toString()).toBe('0');
    expect(row.undistributedAmount.toString()).toBe('50');
    expect(new Prisma.Decimal(row.poolAvailable).equals(new Prisma.Decimal(row.distributedAmount).add(row.undistributedAmount))).toBe(true);
    expect(h.awards).toEqual([]);
    expect(h.reservoir).toHaveLength(1);
    expect(h.reservoir[0].amount.toString()).toBe('50');
    expect(h.reservoir[0].sourceGlobalSettlementId).toBe(row.globalPoolSettlementId);
  });
  it('welfare 2% is accrual-only and creates no member Award, Payable, or Ledger',async()=>{const h=await globalHarness({total:'1000'});const row=await h.service.accrueWelfare(start,end,'TEST_ONLY');expect(row.poolRate.toString()).toBe('0.02');expect(row.accruedAmount.toString()).toBe('20');expect(h.awards).toEqual([]);expect(h.tx.bonusAward.create).not.toHaveBeenCalled();expect(h.tx.payable.create).not.toHaveBeenCalled();expect(h.tx.ledgerEntry.create).not.toHaveBeenCalled();});
});
