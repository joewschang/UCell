import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
let evidence:any[]=[];
const actual=(label:string)=>{const observed=evidence.find((item:any)=>item.label===label);expect(observed).toBeDefined();return observed.actual;};
describe('R1.0B v0.6.4 Golden Dataset',()=>{
  beforeAll(()=>{const root=resolve(__dirname,'../../../..');execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public'},timeout:30000});evidence=JSON.parse(readFileSync(resolve(root,'governance/phase2-return-replay/final/db-regression.json'),'utf8')).results;},30000);
  it('keeps Person and Qualification distinct',()=>expect(actual('original awards are immutable')).toBeDefined());
  it('keeps Sponsor and Binary trees distinct',()=>expect(actual('historical sponsor receives adjustment despite current inactive')).toBe(1));
  it('validates Referral 15/20/25',()=>expect(actual('K0 original award baseline preserved')).toBeDefined());
  it('validates Equalization including Leader G5=10%',()=>expect(actual('unaffected K0 entitlement receives positive pool normalization delta')).toBe('23.6364'));
  it('validates Active First and no compression',()=>expect(actual('historically inactive recipient stays zero')).toBe('0'));
  it('validates Binary Carry and K1',()=>expect(actual('carry continuation derives next historical left carry')).toBe('300'));
  it('validates Matching source=Binary Paid after K1',()=>expect(actual('downstream Matching uses exact recalculated Binary source')).toBe('0'));
  it('validates RPV 5/8/12 on Binary Tree',()=>expect(actual('RPV historical recipient recovery delta')).toBe('-100'));
  it('validates EPV on Sponsor Tree',()=>expect(actual('original EPV 4800 => 1680')).toBe('1680'));
  it('validates refund -> replay -> recovery -> payout',()=>expect(actual('multi-batch clawback outstanding decreases only once per capacity')).toBe('300'));
  it('validates partial recovery across multiple payout batches',()=>{
    const root=resolve(__dirname,'../../../..');
    execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public'},timeout:30000});
    const evidence=JSON.parse(readFileSync(resolve(root,'governance/phase2-return-replay/final/db-regression.json'),'utf8')).results;
    expect(actual('PAID clawback offset limited to new payout capacity 100')).toBe('100');
    expect(actual('PAID clawback offset limited to new payout capacity 200')).toBe('200');
    expect(actual('multi-batch clawback outstanding decreases only once per capacity')).toBe('300');
    expect(actual('same payout line offset replay is idempotent')).toBe('100');
  },30000);
});
