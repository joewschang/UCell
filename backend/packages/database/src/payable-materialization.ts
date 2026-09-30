import {Prisma} from '@prisma/client';
import {isReservoirBSource} from './reservoir-b';

export type PayablePeriod={periodStart:Date;periodEnd:Date;settlementSourceIds?:string[];globalSourceIds?:string[]};
export async function preparationSourcePeriod(db:Pick<Prisma.TransactionClient,'periodCloseJob'>,job:PayablePeriod&{prerequisiteIds:Prisma.JsonValue}):Promise<PayablePeriod>{
  const prerequisites=await db.periodCloseJob.findMany({where:{periodCloseJobId:{in:job.prerequisiteIds as string[]}},include:{receipt:true}});
  return {periodStart:job.periodStart,periodEnd:job.periodEnd,
    settlementSourceIds:prerequisites.filter(row=>['REFERRAL_K0','BINARY_K1','MATCHING_K2'].includes(row.kind)&&row.receipt).map(row=>row.receipt!.sourceId),
    globalSourceIds:prerequisites.filter(row=>row.kind==='GLOBAL'&&row.receipt).map(row=>row.receipt!.sourceId)};
}
export function periodBonusAwardWhere(period:PayablePeriod):Prisma.BonusAwardWhereInput{
  return {OR:[
    ...(period.settlementSourceIds?[{settlementBatchId:{in:period.settlementSourceIds}}]:[{settlementBatch:{is:{periodStart:{gte:period.periodStart},periodEnd:{lte:period.periodEnd}}}}]),
    {settlementBatchId:null,occurredAt:{gte:period.periodStart,lt:period.periodEnd}},
  ]};
}

/** Shared API/Worker materialization. The caller owns the complete transaction. */
export async function materializePayableEntries(tx:Prisma.TransactionClient,cutoff:Date,ruleVersionCode:string,period?:PayablePeriod){
  let created=0;
  const entries:Array<{payableEntryId:string;sourceType:string;sourceId:string;awardType:string;grossAmount:string;availableAt:string;ruleVersionCode:string}>=[];
  async function materialize(sourceType:string,sourceId:string,qualificationId:string,awardType:Prisma.PayableEntryCreateInput['awardType'],grossAmount:Prisma.Decimal){
    if(grossAmount.lte(0)||await isReservoirBSource(tx,sourceId))return;
    let row=await tx.payableEntry.findUnique({where:{sourceType_sourceId:{sourceType,sourceId}}});
    if(!row){row=await tx.payableEntry.create({data:{qualificationId,sourceType,sourceId,awardType,grossAmount,availableAt:cutoff,status:'OPEN',ruleVersionCode}});created++;}
    entries.push({payableEntryId:row.payableEntryId,sourceType,sourceId,awardType,grossAmount:row.grossAmount.toFixed(4),availableAt:row.availableAt.toISOString(),ruleVersionCode:row.ruleVersionCode});
  }
  const awards=await tx.bonusAward.findMany({where:{ruleVersionCode,pendingUntil:{lte:cutoff},lifecycleEvents:{some:{status:'EFFECTIVE'}},...(period?periodBonusAwardWhere(period):{})},orderBy:{bonusAwardId:'asc'}});
  for(const row of awards)await materialize('BONUS_AWARD',row.bonusAwardId,row.recipientQualificationId,row.awardType,row.payableAmount);
  const globalAwards=await tx.globalPoolAward.findMany({where:{payableAmount:{gt:0},...(period?.globalSourceIds?{globalPoolSettlementId:{in:period.globalSourceIds}}:{}),settlement:{ruleVersionCode,periodEnd:{lte:cutoff},...(period&&!period.globalSourceIds?{periodStart:{gte:period.periodStart},periodEnd:{lte:new Date(Math.min(period.periodEnd.getTime(),cutoff.getTime()))}}:{})}},orderBy:{globalPoolAwardId:'asc'}});
  for(const row of globalAwards)await materialize('GLOBAL_POOL_AWARD',row.globalPoolAwardId,row.qualificationId,'GLOBAL',row.payableAmount);
  const rpv=await tx.rpvUplineAwardEvent.findMany({where:{payableAmount:{gt:0},ruleVersionCode,occurredAt:{lte:cutoff,...(period?{gte:period.periodStart,lt:period.periodEnd}:{})}},orderBy:{rpvAwardEventId:'asc'}});
  for(const row of rpv)await materialize('RPV_UPLINE_AWARD',row.rpvAwardEventId,row.recipientQualificationId,'RPV',row.payableAmount);
  return {created,entries};
}
