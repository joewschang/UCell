import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export interface ReplayPoolDeltaInput {
  actionKey:string;
  reservoir?:{sourceGlobalSettlementId:string;delta:Prisma.Decimal};
  welfare?:{welfarePoolAccrualId:string;delta:Prisma.Decimal};
}

function assertDelta(delta:Prisma.Decimal){
  if(delta.eq(0)) throw new Error('REPLAY_POOL_DELTA_ZERO');
}

/** Append the Return replay's pool deltas once without changing source facts. */
export async function appendReplayPoolDeltas(tx:Prisma.TransactionClient,input:ReplayPoolDeltaInput){
  const result:{reservoir?:unknown;welfare?:unknown}={};
  if(input.reservoir){
    assertDelta(input.reservoir.delta);
    const source=await tx.globalPoolSettlement.findUniqueOrThrow({where:{globalPoolSettlementId:input.reservoir.sourceGlobalSettlementId}});
    const replayActionKey=`reservoir:${input.actionKey}`;
    const data={reservoirCode:'A',effectType:'REPLAY_ADJUSTMENT' as const,sourceGlobalSettlementId:source.globalPoolSettlementId,
      sourcePeriodStart:source.periodStart,sourcePeriodEnd:source.periodEnd,amount:input.reservoir.delta,ruleVersionCode:source.ruleVersionCode,
      idempotencyKey:replayActionKey,replayActionKey,evidenceHash:hash({kind:'RESERVOIR_REPLAY_ADJUSTMENT',actionKey:input.actionKey,sourceId:source.globalPoolSettlementId,delta:input.reservoir.delta.toFixed(4),ruleVersionCode:source.ruleVersionCode})};
    const existing=await tx.reservoirLedgerEffect.findUnique({where:{replayActionKey}});
    if(existing){
      if(existing.evidenceHash!==data.evidenceHash) throw new Error('REPLAY_POOL_ACTION_CONFLICT');
      result.reservoir=existing;
    } else result.reservoir=await tx.reservoirLedgerEffect.create({data});
  }
  if(input.welfare){
    assertDelta(input.welfare.delta);
    const source=await tx.welfarePoolAccrual.findUniqueOrThrow({where:{welfarePoolAccrualId:input.welfare.welfarePoolAccrualId}});
    const replayActionKey=`welfare:${input.actionKey}`;
    const data={welfarePoolAccrualId:source.welfarePoolAccrualId,effectType:'REPLAY_ADJUSTMENT' as const,amount:input.welfare.delta,
      ruleVersionCode:source.ruleVersionCode,idempotencyKey:replayActionKey,replayActionKey,
      evidenceHash:hash({kind:'WELFARE_REPLAY_ADJUSTMENT',actionKey:input.actionKey,sourceId:source.welfarePoolAccrualId,delta:input.welfare.delta.toFixed(4),ruleVersionCode:source.ruleVersionCode})};
    const existing=await tx.welfarePoolEffect.findUnique({where:{replayActionKey}});
    if(existing){
      if(existing.evidenceHash!==data.evidenceHash) throw new Error('REPLAY_POOL_ACTION_CONFLICT');
      result.welfare=existing;
    } else result.welfare=await tx.welfarePoolEffect.create({data});
  }
  return result;
}
