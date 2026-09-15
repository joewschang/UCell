import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
let evidence: any[];
beforeAll(() => {
 const root=resolve(__dirname,'../../../..'),directory=mkdtempSync(join(tmpdir(),'ucell-v062-'));
 try {
  const file=join(directory,'evidence.json');
  execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public',PHASE2_DB_EVIDENCE_PATH:file},timeout:30000});
  const run=JSON.parse(readFileSync(file,'utf8'));expect(run.result).toBe('PASS');evidence=run.results;
 } finally { rmSync(directory,{recursive:true,force:true}); }
},30000);
function actual(label:string){const row=evidence.find(item=>item.label===label);expect(row).toBeDefined();expect(row.result).toBe('PASS');expect(row.actual).toEqual(row.expected);return row.actual;}
describe('v0.6.2 economic attribution and carry-chain replay',()=>{
  it('historical week includes later GPV_REVERSAL linked to original event',()=>{
    expect(actual('GPV reversal references original GPV event')).toBe(true);
    expect(actual('later reversal belongs to original historical week')).toBe(true);
    expect(actual('DB effective subtree honors partial return')).toBe('500');
  });
  it.todo('return discovers every Binary ancestor impacted by descendant GPV');
  it.todo('period replay recomputes all Binary payable amounts when K1 changes');
  it.todo('period replay recomputes all Matching payable amounts when K2 changes');
  it('next week carry-in uses prior recomputed carry-out',()=>{
    expect(actual('historical cap preserves nonzero left carry')).toBe('500');
    expect(actual('historical cap preserves nonzero right carry')).toBe('800');
    expect(actual('carry continuation derives next historical left carry')).toBe('300');
    expect(actual('carry continuation derives next historical right carry')).toBe('600');
    expect(actual('downstream Binary award replay uses corrected incoming carry')).toBe('-24');
  });
  it.todo('propagation stops when left/right carry match original snapshots');
  it.todo('propagation respects maxWeeks safety horizon');
  it.todo('each replay period is append-only and replay run is resumable');
  it.todo('positive deltas post compensating awards and negative deltas post recovery');
  it('original BinaryCarry, SettlementBatch and BonusAward remain untouched',()=>{
    expect(actual('all original Binary carry rows unchanged')).toBe(true);
    expect(actual('all original Binary settlement batches unchanged')).toBe(true);
    expect(actual('all original Binary award rows unchanged')).toBe(true);
  });
});

describe('v0.6.2 schema convergence',()=>{
  it.todo('migration 0005 references subscription.subscription, not commerce.subscription');
  it('Prisma schema contains adjustment/workflow/replay models',()=>{
    for(const model of ['SettlementAdjustmentBatch','SettlementAdjustmentLine','QualificationWorkflow','SettlementReplayRun','SettlementReplayPeriod']){
      const columns=actual('Prisma DB column convergence '+model);
      expect(columns.length).toBeGreaterThan(0);
    }
  });
  it.todo('RPV reversal anchor uses BonusAwardType.RPV, not EPV');
});
