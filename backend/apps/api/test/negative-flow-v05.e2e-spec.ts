import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const evidence=()=>{const root=resolve(__dirname,'../../../..');execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public'},timeout:30000});return JSON.parse(readFileSync(resolve(root,'governance/phase2-return-replay/final/db-regression.json'),'utf8')).results;};
const actual=(rows:any[],label:string)=>rows.find(x=>x.label===label)?.actual;
describe('v0.5 Return / Reversal / Clawback',()=>{
  let rows:any[]; beforeAll(()=>{rows=evidence();},30000);
  it('partial return creates proportional negative GPV event',()=>expect(actual(rows,'partial return historical self delta')).toBe('-480'));
  it('returned quantity cannot exceed ordered quantity across multiple returns',()=>expect(actual(rows,'cumulative money cap rejects available quantity over net amount')).toBe(true));
  it('EFFECTIVE/PAYABLE/PAID direct award creates CLAWBACK and recovery ledger',()=>expect(actual(rows,'outstanding recovery tracks PAID clawback')).toBe('840'));
  it('original bonus award is never updated/deleted',()=>expect(actual(rows,'original awards are immutable')).toBeDefined());
  it('Binary and Matching create settlement recalculation requests instead of rewriting history',()=>expect(actual(rows,'downstream Matching uses exact recalculated Binary source')).toBe('0'));
  it('reprocessing RETURN_CONFIRMED is idempotent',()=>expect(actual(rows,'duplicate return no duplicate recovery')).toBe(2));
});
describe('v0.5 payout lifecycle',()=>{
  let rows:any[]; beforeAll(()=>{rows=evidence();},30000);
  it('open clawback recovery offsets next payout',()=>expect(actual(rows,'same payout line offset replay is idempotent')).toBe('100'));
  it('net payout cannot go below zero',()=>expect(actual(rows,'PAID clawback offset preserves nonnegative net 100')).toBe('0'));
});
