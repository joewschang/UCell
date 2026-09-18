import {Prisma,BonusAward} from '@prisma/client';
import {createHash} from 'node:crypto';
import {ParameterSnapshot,verifySnapshot,pending} from './parameter-snapshot';
import {bindCompanyLeaderProfile} from './company-profile';
export async function companyOwnerAt(tx:Prisma.TransactionClient,qid:string,at:Date){
 const owners=await tx.qualificationOwnerInterval.findMany({where:{qualificationId:qid,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},take:2});
 if(owners.length>1)pending('ECONOMIC_OWNER_AMBIGUOUS','Exactly one historical owner is required');
 if(owners.length)return owners[0].ownerType==='COMPANY'?owners[0]:null;
 const q=await tx.qualification.findUnique({where:{qualificationId:qid}});
 if(q?.kind==='COMPANY_BOOTSTRAP'||q?.currentCompanyPrincipalId)pending('ECONOMIC_OWNER_MISSING','Company ownership must have historical evidence');
 return null;
}
export async function companyAlwaysActiveAt(tx:Prisma.TransactionClient,qid:string,at:Date){return !!await companyOwnerAt(tx,qid,at);}
export async function accountingMonth(tx:Prisma.TransactionClient,snapshot:ParameterSnapshot,at:Date){
 const timezone=snapshot.parameters.filter(p=>p.code==='accounting.timezone'&&p.scope==='*');
 if(timezone.length!==1||typeof timezone[0].value!=='string')pending('ACCOUNTING_TIMEZONE_MISSING','Exact sealed timezone required');
 const [period]=await tx.$queryRaw<Array<{start:Date;end:Date}>>`
 SELECT date_trunc('month',${at}::timestamptz AT TIME ZONE ${timezone[0].value}) AT TIME ZONE ${timezone[0].value} AS start,
 (date_trunc('month',${at}::timestamptz AT TIME ZONE ${timezone[0].value})+interval '1 month') AT TIME ZONE ${timezone[0].value} AS end`;
 return period;
}
type Source={sourceBonusAwardId?:string;sourceRpvAwardId?:string;sourceGlobalAwardId?:string;qualificationId:string;awardType:string;amount:Prisma.Decimal;at:Date;sourceSettlementId?:string;periodStart:Date;periodEnd:Date};
export async function routeCompanyFinal(tx:Prisma.TransactionClient,source:Source,value:unknown){
 const owner=await companyOwnerAt(tx,source.qualificationId,source.at);if(!owner)return false;
 const snapshot=verifySnapshot(value),qid=source.qualificationId;
 const member=await tx.binaryTreeMembership.findUnique({where:{qualificationId:qid}});
 if(!member||member.effectiveFrom>source.at)pending('COMPANY_TREE_EVIDENCE_MISSING','Company final requires historical tree membership');
 const q=await tx.qualification.findUniqueOrThrow({where:{qualificationId:qid}});
 const binding=q.kind==='COMPANY_BOOTSTRAP'?await bindCompanyLeaderProfile(tx,qid,snapshot):null;
 const sourceId=source.sourceBonusAwardId??source.sourceRpvAwardId??source.sourceGlobalAwardId!;
 const where={OR:[{sourceBonusAwardId:sourceId},{sourceRpvAwardId:sourceId},{sourceGlobalAwardId:sourceId}]};
 const existing=await tx.awardEconomicDestination.findFirst({where});
 if(existing){if(existing.snapshotHash!==snapshot.hash||!existing.finalAmount.eq(source.amount))pending('ECONOMIC_DESTINATION_CONFLICT','Original destination cannot change');return true;}
 const destination=await tx.awardEconomicDestination.create({data:{
  sourceBonusAwardId:source.sourceBonusAwardId,sourceRpvAwardId:source.sourceRpvAwardId,sourceGlobalAwardId:source.sourceGlobalAwardId,
  qualificationId:qid,binaryTreeId:member.binaryTreeId,ownerIntervalId:owner.ownerIntervalId,bindingId:binding?.bindingId,companyPosition:binding?.companyPosition,
  awardType:source.awardType,sourceSettlementId:source.sourceSettlementId,periodStart:source.periodStart,periodEnd:source.periodEnd,
  finalAmount:source.amount,ruleVersion:snapshot.ruleVersionCode,parameterVersion:binding?.parameterVersion??createHash('sha256').update(JSON.stringify(snapshot.parameters.map(r=>r.id).sort())).digest('hex'),
  snapshotHash:snapshot.hash,parameterSnapshot:snapshot as unknown as Prisma.InputJsonValue,effectiveAt:source.at
 }});
 await tx.reservoirBEffect.create({data:{destinationId:destination.destinationId,effectType:'ENTITLEMENT',amountDelta:source.amount,effectiveAt:source.at,idempotencyKey:'reservoir:B:entitlement:'+destination.destinationId}});
 return true;
}
export async function routeCompanyBonus(tx:Prisma.TransactionClient,award:BonusAward,value:unknown){
 // Ordinary members use the original lifecycle without requiring additional snapshot data.
 if(!await companyOwnerAt(tx,award.recipientQualificationId,award.occurredAt))return false;
 const snapshot=verifySnapshot(value);
 const batch=award.settlementBatchId?await tx.settlementBatch.findUniqueOrThrow({where:{settlementBatchId:award.settlementBatchId}}):null;
 const month=batch?null:await accountingMonth(tx,snapshot,award.occurredAt);
 return routeCompanyFinal(tx,{sourceBonusAwardId:award.bonusAwardId,qualificationId:award.recipientQualificationId,awardType:award.awardType,amount:award.payableAmount,
  at:award.occurredAt,sourceSettlementId:batch?.settlementBatchId,periodStart:batch?.periodStart??month!.start,periodEnd:batch?.periodEnd??month!.end},snapshot);
}
export async function isReservoirBSource(tx:Prisma.TransactionClient,id:string){
 return !!await tx.awardEconomicDestination.findFirst({where:{OR:[{sourceBonusAwardId:id},{sourceRpvAwardId:id},{sourceGlobalAwardId:id}]}});
}

/** Sponsor cardinality includes effective immutable bootstrap identities; no rank grant is implied. */
export async function effectiveSponsorDirectCount(tx:Prisma.TransactionClient,sponsorQualificationId:string,at:Date){
 const rows=await tx.$queryRaw<Array<{count:string}>>`
 SELECT count(*)::text AS count FROM organization.sponsor_relationship sr
 WHERE sr.sponsor_qualification_id=${sponsorQualificationId}::uuid AND sr.effective_from<=${at}
 AND (sr.effective_to IS NULL OR sr.effective_to>${at})
 AND (EXISTS(SELECT 1 FROM membership.qualification_status_history qsh WHERE qsh.qualification_id=sr.child_qualification_id
  AND qsh.status='EFFECTIVE' AND qsh.effective_from<=${at} AND (qsh.effective_to IS NULL OR qsh.effective_to>${at}))
 OR EXISTS(SELECT 1 FROM membership.qualification q WHERE q.qualification_id=sr.child_qualification_id AND q.kind='COMPANY_BOOTSTRAP' AND q.effective_at<=${at}))`;
 return Number(rows[0]?.count??'0');
}
