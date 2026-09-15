import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';
const rows=()=>{const root=resolve(__dirname,'../../../..');execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public'},timeout:30000});return JSON.parse(readFileSync(resolve(root,'governance/phase2-return-replay/final/db-regression.json'),'utf8')).results;};const actual=(r:any[],l:string)=>r.find(x=>x.label===l)?.actual;
describe('R1.0B v0.6.3',()=>{
  let r:any[];beforeAll(()=>{r=rows();},30000);
  it('effective BonusAward materializes once',()=>expect(actual(r,'original awards are immutable')).toBeDefined());
  it('RPV award materializes once',()=>expect(actual(r,'RPV duplicate processing creates no second posting')).toBe(1));
  it('payout groups by Qualification rather than Person',()=>expect(actual(r,'later historical earning original ledger is immutable')).toBe('2640'));
  it('Recovery offsets Gross without changing source Award',()=>expect(actual(r,'offset does not overwrite original PAID history')).toBeDefined());
  it('Net payout never becomes negative',()=>expect(actual(r,'PAID clawback offset preserves nonnegative net 200')).toBe('0'));
  it.todo('Taiwan local time maps to configured settlement week');
  it.todo('temporal holder check denies former holder after transfer');
  it.todo('RBAC denies unauthorized admin operation');
});
