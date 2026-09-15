import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
let evidence: any[];
beforeAll(() => {
 const root=resolve(__dirname,'../../../..'),directory=mkdtempSync(join(tmpdir(),'ucell-v060-'));
 const file=join(directory,'evidence.json');
 try {
  execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public',PHASE2_DB_EVIDENCE_PATH:file},timeout:30000});
  const run=JSON.parse(readFileSync(file,'utf8'));expect(run.result).toBe('PASS');evidence=run.results;
 } finally { rmSync(directory,{recursive:true,force:true}); }
},30000);
function actual(label:string){const row=evidence.find(item=>item.label===label);expect(row).toBeDefined();expect(row.result).toBe('PASS');expect(row.actual).toEqual(row.expected);return row.actual;}
describe('R1.0B FROZEN v0.6 invariants',()=>{
 it('return never mutates original Binary settlement',()=>expect(actual('all original Binary settlement batches unchanged')).toBe(true));
 it('return never mutates original Matching settlement',()=>{expect(actual('all original Matching settlement batches unchanged')).toBe(true);expect(actual('all original Matching award rows unchanged')).toBe(true);});
 it('replay uses original carry-in and reversal PV events',()=>{
  expect(actual('GPV reversal references original GPV event')).toBe(true);
  expect(actual('later reversal belongs to original historical week')).toBe(true);
  expect(actual('DB effective subtree honors partial return')).toBe('500');
  expect(actual('historical cap preserves nonzero left carry')).toBe('500');
  expect(actual('historical cap preserves nonzero right carry')).toBe('800');
 });
 it('positive delta creates compensating award',()=>{
  expect(actual('positive replay delta creates exact compensating award').slice(2)).toEqual(['REFERRAL','23.6364','23.6364']);
  actual('positive replay compensating award retains historical evidence');
  expect(actual('positive replay compensating award has one historical replay lifecycle')).toBe(1);
  actual('duplicate return creates no second posting compensating award or recovery');
  actual('K0 original award baseline preserved');
 });
 it('negative delta creates recovery',()=>{
  expect(actual('negative replay delta creates exact original award recovery').slice(3)).toEqual(['263.6364','263.6364','OPEN']);
  expect(actual('replay delta uses exactly one correction direction')).toEqual([null,null]);
  actual('duplicate return creates no second posting compensating award or recovery');
  actual('K0 original award baseline preserved');
 });
 it('future subscription recognition is cancelled, not deleted',()=>{expect(actual('subscription future rows cancelled')).toBe('CANCELLED');expect(actual('cancelled future recognition row retained')).toBe(1);});
 it('recognized RPV gets explicit reversal event',()=>{expect(actual('RPV one negative historical reversal')).toBe(1);actual('original RPV award rows unchanged');});
 it.todo('upgrade has no retroactive bonus effect');
 it.todo('transfer preserves qualificationId and tree positions');
 it.todo('exit preserves qualification for company-held re-transfer');
});
