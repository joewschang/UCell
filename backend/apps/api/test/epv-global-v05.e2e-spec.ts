import { historicalMonthlyEntitlements } from '@ucell/database';
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
describe('v0.5 EPV', () => {
  it('REPURCHASE 4800 => excess 2800 x 60% = 1680 EPV',()=>{expect(historicalMonthlyEntitlements([epv()],new Map([['order',d(4800)]])).get('order')!.toString()).toBe('1680');});
  it('EPV self share = 50% = 840 when Active',()=>expect(actual('original Active EPV self entitlement')).toBe('840'));
  it('EPV Sponsor G1-G5 each 6% when Active',()=>{for(let generation=1;generation<=5;generation++)expect(actual('Active historical EPV Sponsor G'+generation)).toBe('100.8');expect(actual('original inactive EPV Sponsor generation stays zero')).toBe('0');});
  it('EPV does not use Binary tree',()=>expect(actual('Binary-only historical EPV ancestor gets no award')).toBe(0));
  it.todo('non-REPURCHASE order does not create EPV');
});

describe('v0.5 Global/Welfare', () => {
  it.todo('global pool is 5% of period GPV');
  it.todo('weak thresholds are 300k/600k/1m/2m/4m');
  it.todo('rank achievement never downgrades');
  it.todo('monthly payout requires Active and current-month weak side threshold');
  it.todo('passed levels are cumulative');
  it.todo('empty rank slice rolls upward to next higher rank');
  it.todo('welfare 2% is accrued only; no distribution without a formal rule');
});
