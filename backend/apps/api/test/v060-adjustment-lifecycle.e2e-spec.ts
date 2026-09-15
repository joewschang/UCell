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
 it.todo('replay uses original carry-in and reversal PV events');
 it.todo('positive delta creates compensating award');
 it.todo('negative delta creates recovery');
 it('future subscription recognition is cancelled, not deleted',()=>{expect(actual('subscription future rows cancelled')).toBe('CANCELLED');expect(actual('cancelled future recognition row retained')).toBe(1);});
 it('recognized RPV gets explicit reversal event',()=>{expect(actual('RPV one negative historical reversal')).toBe(1);actual('original RPV award rows unchanged');});
 it.todo('upgrade has no retroactive bonus effect');
 it.todo('transfer preserves qualificationId and tree positions');
 it.todo('exit preserves qualification for company-held re-transfer');
});
