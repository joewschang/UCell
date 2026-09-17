import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { periodBinary } from '@ucell/database';
import { binary, d, recipient } from './phase2-fixtures';
import { phase2DbEvidence } from './phase2-db-evidence';
let evidence: any[];
beforeAll(() => { evidence=[...phase2DbEvidence()]; },30000);
function actual(label:string){const row=evidence.find(item=>item.label===label);expect(row).toBeDefined();expect(row.result).toBe('PASS');expect(row.actual).toEqual(row.expected);return row.actual;}
describe('v0.6.2 economic attribution and carry-chain replay',()=>{
  it('historical week includes later GPV_REVERSAL linked to original event',()=>{
    expect(actual('GPV reversal references original GPV event')).toBe(true);
    expect(actual('later reversal belongs to original historical week')).toBe(true);
    expect(actual('DB effective subtree honors partial return')).toBe('500');
  });
  it('return discovers every historical Binary ancestor impacted by descendant GPV',()=>{
    const envelope=binary();
    for(const source of envelope.evidence.sources) source.evidence.binary.push({parentQualificationId:'root2',childQualificationId:'root',side:'LEFT'});
    envelope.evidence.carryRecipients.push({...envelope.evidence.carryRecipients[0],qualificationId:'root2',leftCarryIn:'0',rightCarryIn:'0',leftCarryOut:'2000',rightCarryOut:'0'});
    envelope.recipients.push(recipient({key:'root2-award',awardId:'root2-award',qualificationId:'root2',theory:'0',posted:'0'}));
    const result=periodBinary(envelope,new Map([['left',d(500)],['right',d(1000)]]),new Map());
    expect([...result.carryOut.keys()].sort()).toEqual(['root','root2']);
    expect(result.carryOut.get('root2')!.left.toString()).toBe('1500');
    expect(result.payables.has('root2-award')).toBe(true);
  });
  it('period replay recomputes all Binary payable amounts when K1 changes',()=>{
    expect(actual('complete replay posts every Binary entitlement')).toBe(3);
  });
  it('period replay recomputes all Matching payable amounts when K2 changes',()=>{
    expect(actual('complete replay posts every Matching entitlement')).toBe(3);
    expect(actual('downstream Matching uses exact recalculated Binary source')).toBe('0');
  });
  it('next week carry-in uses prior recomputed carry-out',()=>{
    expect(actual('historical cap preserves nonzero left carry')).toBe('500');
    expect(actual('historical cap preserves nonzero right carry')).toBe('800');
    expect(actual('carry continuation derives next historical left carry')).toBe('300');
    expect(actual('carry continuation derives next historical right carry')).toBe('600');
    expect(actual('downstream Binary award replay uses corrected incoming carry')).toBe('-24');
  });
  it('propagation stops when carry and awards match original snapshots',()=>{
    expect(actual('propagation stops at first converged carry and award boundary')).toEqual([3,[]]);
    expect(actual('complete replay processes affected periods through convergence')).toBe(3);
  });
  it('propagation respects maxWeeks safety horizon',()=>{
    expect(actual('maxWeeks returns explicit incomplete status')).toEqual(['REPLAY_INCOMPLETE','REPLAY_INCOMPLETE',1,1]);
    expect(actual('maxWeeks persists resumable non-monetary checkpoint')).toEqual(['MAX_HORIZON',1,1]);
    expect(actual('incomplete replay appends no monetary entitlement')).toBe(0);
  });
  it('each replay period is append-only and replay run is resumable',()=>{
    expect(actual('incomplete replay appends exactly one immutable period checkpoint')).toBe(1);
    expect(actual('resume converges same replay run')).toEqual([true,'CONVERGED',3]);
    expect(actual('resume preserves and completes append-only period checkpoints')).toBe(3);
    expect(actual('period checkpoints capture complete K1 and K2 replay')).toHaveLength(3);
    actual('replay period checkpoint UPDATE rejected by DB');
  });
  it('positive deltas post compensating awards and negative deltas post recovery',()=>{
    expect(actual('positive replay delta creates exact compensating award')[2]).toBe('REFERRAL');
    expect(actual('negative replay delta creates exact original award recovery')[0]).toBe('-263.6364');
    expect(actual('replay delta uses exactly one correction direction')).toEqual([null,null]);
  });
  it('original BinaryCarry, SettlementBatch and BonusAward remain untouched',()=>{
    expect(actual('all original Binary carry rows unchanged')).toBe(true);
    expect(actual('all original Binary settlement batches unchanged')).toBe(true);
    expect(actual('all original Binary award rows unchanged')).toBe(true);
  });
});

describe('v0.6.2 schema convergence',()=>{
  it('adjustment/subscription migrations reference subscription.subscription, not commerce.subscription',()=>{
    const adjustment=readFileSync(resolve(__dirname,'../../../packages/database/prisma/migrations/0005_adjustment_lifecycle/migration.sql'),'utf8');
    const cancellation=readFileSync(resolve(__dirname,'../../../packages/database/prisma/migrations/0006_v061_closure/migration.sql'),'utf8');
    expect(adjustment).not.toContain('REFERENCES commerce.subscription');
    expect(cancellation).toContain('REFERENCES subscription.subscription');
    expect(cancellation).not.toContain('REFERENCES commerce.subscription');
  });
  it('Prisma schema contains adjustment/workflow/replay models',()=>{
    for(const model of ['SettlementAdjustmentBatch','SettlementAdjustmentLine','QualificationWorkflow','SettlementReplayRun','SettlementReplayPeriod']){
      const columns=actual('Prisma DB column convergence '+model);
      expect(columns.length).toBeGreaterThan(0);
    }
  });
  it('RPV reversal anchor uses BonusAwardType.RPV, not EPV',()=>{
    expect(actual('RPV recovery anchor uses original RPV type and historical recipient')).toEqual(['RPV','0',true]);
    expect(actual('RPV historical recipient recovery delta')).toBe('-100');
    actual('original RPV award rows unchanged');
  });
});
