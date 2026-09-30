import {Prisma,PrismaService,verifySnapshot,periodBonusAwardWhere,periodCloseMaturityReady,matureBonusAward,materializePayableEntries,storeReplaySnapshot} from '@ucell/database';
import {BinaryBonusService} from './bonus/binary-bonus.service';
import {ReferralBonusService} from './bonus/referral-bonus.service';
import {BonusQueryService} from './bonus/bonus-query.service';
import {RuntimeRuleService} from './rules/runtime-rule.service';
import {SettlementCalendarService} from './settlement/settlement-calendar.service';
import {GlobalPoolService} from './global-pool/global-pool.service';
import {GlobalPoolPersistence} from './global-pool/global-pool-persistence';

/** All engine writes stay in the caller's fenced transaction. No nested commit. */
export async function executePeriodClose(tx:Prisma.TransactionClient,job:Prisma.PeriodCloseJobGetPayload<{}>):Promise<string>{
  const client=new Proxy(tx,{get(target,key){return key==='$transaction'?(work:(inner:Prisma.TransactionClient)=>unknown)=>work(tx):Reflect.get(target,key);}}) as unknown as PrismaService;
  const rules=new RuntimeRuleService(client),query=new BonusQueryService(client),calendar=new SettlementCalendarService(client);
  const pinned=verifySnapshot(job.parameterSnapshot);
  // Revalidate the approved calendar and stop on drift before any economic write.
  const current=await calendar.captureForPeriod(tx,job.periodStart,job.periodEnd,job.kind,job.ruleVersionCode);
  if(current.hash!==pinned.hash)throw new Error('PERIOD_CLOSE_PARAMETER_DRIFT');
  if(job.kind==='PAYABLE_PREPARATION'){
    const now=new Date();
    if(!await periodCloseMaturityReady(tx,job,now))throw new Error('PERIOD_CLOSE_MATURITY_PENDING');
    const awards=await tx.bonusAward.findMany({where:{ruleVersionCode:job.ruleVersionCode,pendingUntil:{lte:now},...periodBonusAwardWhere(job)},orderBy:{bonusAwardId:'asc'}});
    for(const award of awards)await matureBonusAward(client,award.bonusAwardId,now);
    const result=await materializePayableEntries(tx,now,job.ruleVersionCode,job);
    await storeReplaySnapshot(tx,{format:'UCELL_HISTORICAL_REPLAY_V1',kind:job.kind,sourceId:job.periodCloseJobId,ruleVersionCode:job.ruleVersionCode,
      at:now.toISOString(),parameters:pinned,recipients:[],
      inputs:{periodStart:job.periodStart.toISOString(),periodEnd:job.periodEnd.toISOString(),cutoff:now.toISOString()},
      evidence:{prerequisiteIds:job.prerequisiteIds,payables:result.entries,created:result.created}});
    return job.periodCloseJobId;
  }
  if(job.kind==='GLOBAL')return (await new GlobalPoolService(client,rules,query,calendar,new GlobalPoolPersistence()).evaluateAndSettle(job.periodStart,job.periodEnd,job.ruleVersionCode)).globalPoolSettlementId;
  if(job.kind==='WELFARE')return (await new GlobalPoolService(client,rules,query,calendar,new GlobalPoolPersistence()).accrueWelfare(job.periodStart,job.periodEnd,job.ruleVersionCode)).welfarePoolAccrualId;
  if(job.kind==='REFERRAL_K0')return (await new ReferralBonusService(client,rules,query,calendar).settle(job.periodStart,job.periodEnd,job.ruleVersionCode)).settlementBatchId;
  const binary=new BinaryBonusService(client,rules,query,calendar);
  if(job.kind==='BINARY_K1')return (await binary.settleBinary(job.periodStart,job.periodEnd,job.ruleVersionCode)).settlementBatchId;
  if(job.kind==='MATCHING_K2')return (await binary.settleMatching(job.periodStart,job.periodEnd,job.ruleVersionCode)).settlementBatchId;
  throw new Error('PERIOD_CLOSE_KIND_UNSUPPORTED');
}
