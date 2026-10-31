import {appendMemberMessage} from './member-message';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

export type OpportunityReason = { code: 'INACTIVE' | 'PLAN_INSUFFICIENT' | 'DIRECT_COUNT_INSUFFICIENT'; actual: string | number | boolean; required: string | number | boolean };
export type OpportunityCandidate = {
  recipientQualificationId: string; sourceKey: string; awardType: string; generation: number;
  theoreticalAmount: Prisma.Decimal; occurredAt: Date; reasons: OpportunityReason[];
  parameterSnapshotHash: string; detail: Prisma.InputJsonObject;
};
export function opportunityReasons(active: boolean, plan: string, requiredPlan: string, directs: number, requiredDirects: number): OpportunityReason[] {
  const reasons: OpportunityReason[] = [];
  if (!active) reasons.push({code:'INACTIVE',actual:false,required:true});
  if (plan !== requiredPlan) reasons.push({code:'PLAN_INSUFFICIENT',actual:plan,required:requiredPlan});
  if (directs < requiredDirects) reasons.push({code:'DIRECT_COUNT_INSUFFICIENT',actual:directs,required:requiredDirects});
  return reasons;
}
export function equalizationRequirement(plan: string, generation: number) {
  const maximum: Record<string, number> = {STARTER:4,ELITE:6,LEADER:7};
  const requiredPlan = (maximum[plan] ?? 0) >= generation ? plan : generation <= 4 ? 'STARTER' : generation <= 6 ? 'ELITE' : 'LEADER';
  return {requiredPlan, requiredDirects:generation <= 3 ? 1 : generation === 4 ? 2 : generation === 5 ? 3 : 4};
}
const labels: Record<string,string> = {REFERRAL:'推薦獎金',EQUALIZATION:'均等獎金',BINARY:'組織對碰獎金',MATCHING:'對碰對等獎金'};
export function opportunityMessage(input:{awardType:string;generation:number;occurredAt:Date;estimatedAmount:Prisma.Decimal;reasons:OpportunityReason[];provisional?:boolean}) {
  const why = input.reasons.map(r => r.code === 'INACTIVE' ? '• 資格判定時未具活躍資格' : r.code === 'PLAN_INSUFFICIENT' ? `• 會員等級需 ${r.required}，當時為 ${r.actual}` : `• 有效直推需 ${r.required} 位，當時為 ${r.actual} 位，尚差 ${Number(r.required)-Number(r.actual)} 位`);
  return ['【UCell 獎金機會未取得通知】',`${labels[input.awardType] ?? input.awardType}${input.generation ? `（第 ${input.generation} 代）` : ''}`,
    `資格判定時間：${new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short',hour12:false}).format(input.occurredAt)}`,
    `預估未取得金額：NT$${input.estimatedAmount.toFixed(2)}`,...why,
    input.provisional?'此為事件發生時、獎金池係數調整前的機會試算；結算後可能調整，非已入帳或可補領金額。':'此為本批次所列機會的局部試算，非完整升級收益或可補領金額；池係數已按所列機會重算。',
    '請至會員中心通知查看紀錄與資格條件。'].join('\n');
}

/** Called inside the settlement transaction. Never writes awards, carry or payable entries. */
export async function recordBonusOpportunities(tx:Prisma.TransactionClient, batch:{settlementBatchId:string|null;ruleVersionCode:string;sourceEventId?:string}, candidates:OpportunityCandidate[], totalTheory:Prisma.Decimal, poolAvailable:Prisma.Decimal, actualRows:Array<{recipientQualificationId:string;theoryAmount:Prisma.Decimal}>) {
  const positive = candidates.filter(c=>c.theoreticalAmount.gt(0)&&c.reasons.length);
  const missed = new Map<string,Prisma.Decimal>();
  const own = new Map<string,Prisma.Decimal>();
  for (const c of positive) missed.set(c.recipientQualificationId,(missed.get(c.recipientQualificationId)??new Prisma.Decimal(0)).add(c.theoreticalAmount));
  for (const r of actualRows) own.set(r.recipientQualificationId,(own.get(r.recipientQualificationId)??new Prisma.Decimal(0)).add(r.theoryAmount));
  const actualK = totalTheory.gt(0) ? Prisma.Decimal.min(1,poolAvailable.div(totalTheory)) : new Prisma.Decimal(1);
  for (const c of positive) {
    const missing = missed.get(c.recipientQualificationId)!;
    const original = own.get(c.recipientQualificationId)??new Prisma.Decimal(0);
    const scenarioK = Prisma.Decimal.min(1,poolAvailable.div(totalTheory.add(missing)));
    const delta = Prisma.Decimal.max(0,original.add(missing).mul(scenarioK).sub(original.mul(actualK)));
    const estimatedAmount = batch.settlementBatchId ? delta.mul(c.theoreticalAmount).div(missing).toDecimalPlaces(4) : c.theoreticalAmount.toDecimalPlaces(4);
    if (estimatedAmount.lt('0.005')) continue;
    const qualification = await tx.qualification.findUnique({where:{qualificationId:c.recipientQualificationId}});
    if (qualification?.kind !== 'MEMBER_ORIGIN') continue;
    // Address the historical holder; never leak an old holder's event to a new holder.
    const holder = await tx.qualificationHolderHistory.findFirst({where:{qualificationId:c.recipientQualificationId,effectiveFrom:{lte:c.occurredAt},OR:[{effectiveTo:null},{effectiveTo:{gt:c.occurredAt}}]},orderBy:{effectiveFrom:'desc'}});
    if (!holder) throw new Error('BONUS_OPPORTUNITY_HISTORICAL_HOLDER_MISSING');
    if (!holder.holderPersonId) continue; // A legal entity has no personal LINE audience.
    const key = createHash('sha256').update(JSON.stringify([batch.settlementBatchId??batch.sourceEventId,c.recipientQualificationId,c.awardType,c.sourceKey,c.generation])).digest('hex');
    const existing = await tx.bonusOpportunity.findUnique({where:{opportunityKey:key}});
    if (existing) continue;
    const eventId = randomUUID();
    const body = opportunityMessage({...c,estimatedAmount,provisional:!batch.settlementBatchId});
    const opportunity = await tx.bonusOpportunity.create({data:{opportunityKey:key,settlementBatchId:batch.settlementBatchId,personId:holder.holderPersonId,qualificationId:c.recipientQualificationId,sourceKey:c.sourceKey,awardType:c.awardType,generation:c.generation,theoreticalAmount:c.theoreticalAmount,estimatedAmount,reasons:c.reasons,occurredAt:c.occurredAt,ruleVersionCode:batch.ruleVersionCode,parameterSnapshotHash:c.parameterSnapshotHash,calculationDetail:{...c.detail,scenarioK:scenarioK.toString(),actualK:actualK.toString(),recipientMissingTheory:missing.toString(),recipientActualTheory:original.toString(),amountKind:batch.settlementBatchId?'COUNTERFACTUAL_ESTIMATE':'PRE_POOL_ESTIMATE'},message:body,outboxEventId:eventId}});
    await appendMemberMessage(tx,{messageKey:'bonus-opportunity:'+key,personId:holder.holderPersonId,qualificationId:c.recipientQualificationId,category:'AWARD',title:'獎金機會未取得通知',body,sourceType:'BONUS_OPPORTUNITY',sourceReference:'BONUS-'+key.slice(0,40),deepLink:'/bonuses'});
    await tx.notificationDelivery.create({data:{personId:holder.holderPersonId,channel:'LINE',notificationType:'BONUS_OPPORTUNITY',evidenceHash:key,status:'PENDING'}});
    await tx.outboxEvent.create({data:{outboxEventId:eventId,eventType:'BONUS_OPPORTUNITY_CREATED',aggregateType:'BONUS_OPPORTUNITY',aggregateId:opportunity.bonusOpportunityId,correlationId:eventId,payload:{opportunityId:opportunity.bonusOpportunityId}}});
  }
}

/** A refund replay invalidates the old estimate, never rewrites a sent message.
 * The correction explicitly withdraws the amount instead of inventing a new one. */
export async function invalidateBonusOpportunities(tx:Prisma.TransactionClient,input:{batchIds:string[];sourceKeys:string[];actionKey:string}) {
  if(!input.batchIds.length&&!input.sourceKeys.length)return;
  const rows=await tx.bonusOpportunity.findMany({where:{reviewRequired:false,OR:[{settlementBatchId:{in:input.batchIds}},{sourceKey:{in:input.sourceKeys}}]}});
  for(const row of rows){
    const hash=createHash('sha256').update(`bonus-opportunity-correction:${row.bonusOpportunityId}:${input.actionKey}`).digest('hex');
    const eventId=`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const message=`【UCell 獎金機會更正通知】\n${labels[row.awardType]??row.awardType}\n原預估未取得金額：NT$${row.estimatedAmount.toFixed(2)}\n此筆來源或結算池已因退款重算，原機會金額已失效，請勿再以此金額評估損失。\n目前尚無重新確認的機會金額；本通知不影響正式獎金帳務，詳細紀錄請洽客服。`;
    await tx.bonusOpportunity.update({where:{bonusOpportunityId:row.bonusOpportunityId},data:{reviewRequired:true}});
    await tx.outboxEvent.upsert({where:{outboxEventId:eventId},update:{},create:{outboxEventId:eventId,eventType:'BONUS_OPPORTUNITY_CORRECTED',aggregateType:'BONUS_OPPORTUNITY',aggregateId:row.bonusOpportunityId,correlationId:eventId,payload:{opportunityId:row.bonusOpportunityId,evidenceHash:hash,message,actionKey:input.actionKey}}});
    await appendMemberMessage(tx,{messageKey:'bonus-opportunity-correction:'+hash,personId:row.personId,qualificationId:row.qualificationId,category:'AWARD',title:'獎金機會更正通知',body:message,sourceType:'BONUS_OPPORTUNITY',sourceReference:'BONUS-'+hash.slice(0,40),deepLink:'/bonuses'});
    await tx.notificationDelivery.upsert({where:{personId_channel_notificationType_evidenceHash:{personId:row.personId,channel:'LINE',notificationType:'BONUS_OPPORTUNITY',evidenceHash:hash}},update:{},create:{personId:row.personId,channel:'LINE',notificationType:'BONUS_OPPORTUNITY',evidenceHash:hash,status:'PENDING'}});
  }
}
