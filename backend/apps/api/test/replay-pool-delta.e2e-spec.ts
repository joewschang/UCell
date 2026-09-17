import { appendReplayPoolDeltas, Prisma } from '@ucell/database';

describe('Return replay pool deltas',()=>{
  const global={globalPoolSettlementId:'10000000-0000-4000-8000-000000000001',periodStart:new Date('2026-09-01'),periodEnd:new Date('2026-09-16'),ruleVersionCode:'R1.0B'};
  const welfare={welfarePoolAccrualId:'20000000-0000-4000-8000-000000000001',ruleVersionCode:'R1.0B'};
  function harness(){
    const reservoirRows:any[]=[];const welfareRows:any[]=[];
    const tx:any={
      globalPoolSettlement:{findUniqueOrThrow:jest.fn(async()=>global)},welfarePoolAccrual:{findUniqueOrThrow:jest.fn(async()=>welfare)},
      reservoirLedgerEffect:{findUnique:jest.fn(async({where}:any)=>reservoirRows.find(x=>x.replayActionKey===where.replayActionKey)??null),create:jest.fn(async({data}:any)=>{reservoirRows.push(data);return data;})},
      welfarePoolEffect:{findUnique:jest.fn(async({where}:any)=>welfareRows.find(x=>x.replayActionKey===where.replayActionKey)??null),create:jest.fn(async({data}:any)=>{welfareRows.push(data);return data;})},
    };
    return {tx,reservoirRows,welfareRows};
  }

  it('appends signed Reservoir and Welfare deltas exactly once for one Return action',async()=>{
    const h=harness(),input={actionKey:'RETURN:r1:POOL',reservoir:{sourceGlobalSettlementId:global.globalPoolSettlementId,delta:new Prisma.Decimal('-7.5')},welfare:{welfarePoolAccrualId:welfare.welfarePoolAccrualId,delta:new Prisma.Decimal('-3')}};
    await appendReplayPoolDeltas(h.tx,input);await appendReplayPoolDeltas(h.tx,input);
    expect(h.reservoirRows).toHaveLength(1);expect(h.welfareRows).toHaveLength(1);
    expect(h.reservoirRows[0]).toMatchObject({effectType:'REPLAY_ADJUSTMENT',replayActionKey:'reservoir:RETURN:r1:POOL'});
    expect(h.welfareRows[0]).toMatchObject({effectType:'REPLAY_ADJUSTMENT',replayActionKey:'welfare:RETURN:r1:POOL'});
  });

  it('rejects reuse of a replay action for a different delta',async()=>{
    const h=harness();
    await appendReplayPoolDeltas(h.tx,{actionKey:'RETURN:r2:POOL',reservoir:{sourceGlobalSettlementId:global.globalPoolSettlementId,delta:new Prisma.Decimal('-1')}});
    await expect(appendReplayPoolDeltas(h.tx,{actionKey:'RETURN:r2:POOL',reservoir:{sourceGlobalSettlementId:global.globalPoolSettlementId,delta:new Prisma.Decimal('-2')}})).rejects.toThrow('REPLAY_POOL_ACTION_CONFLICT');
  });
});
