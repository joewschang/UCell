import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';
import { Prisma } from '@ucell/database';
import { UnifiedPayableService } from '../src/modules/payout/unified-payable.service';
import { AdminOperationsService } from '../src/modules/admin-operations/admin-operations.service';
let evidence:any[];
beforeAll(()=>{
 const root=resolve(__dirname,'../../../..');
 execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public'},timeout:30000});
 const run=JSON.parse(readFileSync(resolve(root,'governance/phase2-return-replay/final/db-regression.json'),'utf8'));expect(run.result).toBe('PASS');evidence=run.results;
},30000);
function assertion(label:string){const row=evidence.find(r=>r.label===label);expect(row).toBeDefined();expect(row.result).toBe('PASS');expect(row.actual).toEqual(row.expected);return row.actual;}
describe('v0.5 Return / Reversal / Clawback', () => {
  it.todo('partial return creates proportional negative GPV event');
  it('GPV reversal references original GPV event',()=>expect(assertion('GPV reversal references original GPV event')).toBe(true));
  it('returned quantity cannot exceed ordered quantity across multiple returns',()=>expect(assertion('cumulative returned quantity cannot exceed original quantity')).toBe(true));
  it('PENDING_45D direct referral/equalization becomes REVERSED',()=>{
    expect(assertion('PENDING_45D historical zero entitlement appends REVERSED lifecycle')).toBe('REVERSED');
    expect(assertion('PENDING_45D reversal creates no recovery')).toEqual([null,0]);
  });
  it('EFFECTIVE/PAYABLE/PAID direct award creates CLAWBACK and recovery ledger',()=>{
    expect(assertion('PAID historical reduction appends one CLAWBACK lifecycle')).toBe(1);
    expect(assertion('outstanding recovery tracks PAID clawback')).toBe('840');
    expect(assertion('offset does not overwrite original PAID history')).toBeDefined();
  });
  it('original bonus award is never updated/deleted',()=>{assertion('original awards are immutable');assertion('K0 original award baseline preserved');});
  it('Binary and Matching create settlement recalculation requests instead of rewriting history',()=>{
    expect(assertion('posted return creates historical Binary and Matching recalculation requests').map((row:any[])=>row.slice(0,2))).toEqual([['BINARY_K1','PENDING'],['MATCHING_K2','PENDING']]);
    expect(assertion('idempotent return creates no duplicate recalculation requests')).toBe(2);
    expect(assertion('successful historical replay processes recalculation requests').map((row:any[])=>row.slice(0,2))).toEqual([['BINARY_K1','PROCESSED'],['MATCHING_K2','PROCESSED']]);
    assertion('all original Binary settlement batches unchanged');
    assertion('all original Matching settlement batches unchanged');
  });
  it('reprocessing RETURN_CONFIRMED is idempotent',()=>{assertion('duplicate RETURN_CONFIRMED appends no ledger');assertion('duplicate RETURN_CONFIRMED appends no entitlement posting');});
});

describe('v0.5 payout lifecycle', () => {
  it('EFFECTIVE awards become PAYABLE via payout materialization',async()=>{
    const award={bonusAwardId:'award-A',recipientQualificationId:'ball-A',awardType:'REFERRAL',payableAmount:new Prisma.Decimal(125)};
    const created:any[]=[];
    const tx:any={bonusAward:{findMany:jest.fn(async()=>[award])},globalPoolAward:{findMany:jest.fn(async()=>[])},rpvUplineAwardEvent:{findMany:jest.fn(async()=>[])},payableEntry:{findUnique:jest.fn(async()=>null),create:jest.fn(async({data}:any)=>{created.push(data);return data;})}};
    const service=new UnifiedPayableService({$transaction:async(work:any)=>work(tx)} as any,{} as any);
    expect(await service.materialize(new Date('2020-03-01T00:00:00Z'),'R1.0B')).toEqual({created:1});
    expect(created).toEqual([expect.objectContaining({qualificationId:'ball-A',sourceType:'BONUS_AWARD',sourceId:'award-A',awardType:'REFERRAL',grossAmount:new Prisma.Decimal(125),status:'OPEN',ruleVersionCode:'R1.0B'})]);
  });
  it('open clawback recovery offsets next payout',()=>{expect(assertion('PAID clawback offset limited to new payout capacity 100')).toBe('100');expect(assertion('PAID clawback offset limited to new payout capacity 200')).toBe('200');});
  it('net payout cannot go below zero',()=>{expect(assertion('PAID clawback offset preserves nonnegative net 100')).toBe('0');expect(assertion('PAID clawback offset preserves nonnegative net 200')).toBe('0');});
  it('mark-paid writes append-only PAID lifecycle events',async()=>{
    const paidAt=new Date('2020-03-02T00:00:00Z'),create=jest.fn(),updateMany=jest.fn();
    const tx:any={payoutBatch:{findUniqueOrThrow:jest.fn(async()=>({payoutBatchId:'batch-A',status:'EXPORTED'})),update:jest.fn(async({data}:any)=>data)},payableEntry:{findMany:jest.fn(async()=>[{sourceId:'award-A'}]),updateMany},bonusAwardLifecycleEvent:{findFirst:jest.fn(async()=>null),create}};
    const audit={write:jest.fn()};
    const service=new AdminOperationsService({$transaction:async(work:any)=>work(tx)} as any,audit as any);
    await service.markPaid('batch-A',{paymentReference:'bank-A',paymentMethod:'BANK',paidAt},'finance-A','FINANCE','request-A','correlation-A');
    expect(create).toHaveBeenCalledWith({data:{bonusAwardId:'award-A',status:'PAID',occurredAt:paidAt,reasonCode:'PAYOUT_PAID'}});
    expect(updateMany).toHaveBeenCalledWith({where:{payoutLine:{payoutBatchId:'batch-A'},status:'ALLOCATED'},data:{status:'PAID'}});
    expect(audit.write).toHaveBeenCalledWith(tx,expect.objectContaining({action:'PAYOUT_PAID',entityId:'batch-A'}));
  });
});
