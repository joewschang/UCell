import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('R1.0B v0.6.4 Golden Dataset',()=>{
  it.todo('keeps Person and Qualification distinct');
  it.todo('keeps Sponsor and Binary trees distinct');
  it.todo('validates Referral 15/20/25');
  it.todo('validates Equalization including Leader G5=10%');
  it.todo('validates Active First and no compression');
  it.todo('validates Binary Carry and K1');
  it.todo('validates Matching source=Binary Paid after K1');
  it.todo('validates RPV 5/8/12 on Binary Tree');
  it.todo('validates EPV on Sponsor Tree');
  it.todo('validates refund -> replay -> recovery -> payout');
  it('validates partial recovery across multiple payout batches',()=>{
    const root=resolve(__dirname,'../../../..');
    execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public'},timeout:30000});
    const evidence=JSON.parse(readFileSync(resolve(root,'governance/phase2-return-replay/final/db-regression.json'),'utf8')).results;
    const actual=(label:string)=>{const observed=evidence.find((item:any)=>item.label===label);expect(observed).toBeDefined();return observed.actual;};
    expect(actual('PAID clawback offset limited to new payout capacity 100')).toBe('100');
    expect(actual('PAID clawback offset limited to new payout capacity 200')).toBe('200');
    expect(actual('multi-batch clawback outstanding decreases only once per capacity')).toBe('300');
    expect(actual('same payout line offset replay is idempotent')).toBe('100');
  },30000);
});
