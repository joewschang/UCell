import {Prisma,periodBonusAwardWhere,periodJobReference,erpBusinessReference} from '@ucell/database';
import {createHash} from 'node:crypto';
import {CompensationPeriod,compensationPeriodEvidence} from './compensation-period-evidence';
import {companyReservoirCandidates} from '../admin-operations/company-reservoir-invariants';
import {readFinanceReviewArtifact} from '../admin-operations/payout-review-artifact';

const zero=()=>new Prisma.Decimal(0);
const sum=(values:Prisma.Decimal[])=>values.reduce((total,value)=>total.add(value),zero());
export const compensationReference=(type:string,id:string)=>`${type}-${createHash('sha256').update(`${type}:${id}`).digest('hex').slice(0,20)}`;
export const compensationPeriodReference=(period:CompensationPeriod)=>compensationReference('COMPENSATION-PERIOD',`${period.ruleVersionCode}:${period.periodStart.toISOString()}:${period.periodEnd.toISOString()}`);
type Source={id:string;type:string;awardType:string;qualificationId:string;theory:Prisma.Decimal|null;amount:Prisma.Decimal;company:boolean;mature:boolean;expected:boolean};

/** Read-only reconciliation over original sources and recorded applications; no allocation policy is invented. */
export async function compensationFinancialEvidence(tx:Prisma.TransactionClient,period:CompensationPeriod,cohort:Awaited<ReturnType<typeof compensationPeriodEvidence>>,now:Date){
 const [bonuses,rpvs,globals]=await Promise.all([
  tx.bonusAward.findMany({where:{ruleVersionCode:period.ruleVersionCode,...periodBonusAwardWhere(cohort.sourcePeriod)},include:{economicDestination:{include:{effects:true}},lifecycleEvents:true},orderBy:{bonusAwardId:'asc'}}),
  tx.rpvUplineAwardEvent.findMany({where:{ruleVersionCode:period.ruleVersionCode,occurredAt:{gte:period.periodStart,lt:period.periodEnd}},include:{economicDestination:{include:{effects:true}}},orderBy:{rpvAwardEventId:'asc'}}),
  tx.globalPoolAward.findMany({where:{globalPoolSettlementId:{in:cohort.sourcePeriod.globalSourceIds}},include:{economicDestination:{include:{effects:true}}},orderBy:{globalPoolAwardId:'asc'}}),
 ]);
 const sources:Source[]=[
  ...bonuses.map(row=>{const hasEffective=row.lifecycleEvents.some(event=>event.status==='EFFECTIVE'),reversed=row.lifecycleEvents.some(event=>event.status==='REVERSED')&&!hasEffective;return {id:row.bonusAwardId,type:'BONUS_AWARD',awardType:row.awardType,qualificationId:row.recipientQualificationId,theory:row.theoryAmount,amount:row.payableAmount,company:Boolean(row.economicDestination),mature:reversed||row.pendingUntil<=now,expected:row.payableAmount.gt(0)&&!row.economicDestination&&!reversed};}),
  ...rpvs.map(row=>({id:row.rpvAwardEventId,type:'RPV_UPLINE_AWARD',awardType:'RPV',qualificationId:row.recipientQualificationId,theory:row.theoryAmount,amount:row.payableAmount,company:Boolean(row.economicDestination),mature:true,expected:row.payableAmount.gt(0)&&!row.economicDestination})),
  ...globals.map(row=>({id:row.globalPoolAwardId,type:'GLOBAL_POOL_AWARD',awardType:'GLOBAL',qualificationId:row.qualificationId,theory:null,amount:row.payableAmount,company:Boolean(row.economicDestination),mature:true,expected:row.payableAmount.gt(0)&&!row.economicDestination})),
 ];
 const scope={bonusIds:bonuses.map(row=>row.bonusAwardId),rpvIds:rpvs.map(row=>row.rpvAwardEventId),globalIds:globals.map(row=>row.globalPoolAwardId)};
 const [payables,postings,companyIssues]=await Promise.all([
  tx.payableEntry.findMany({where:{OR:[{sourceType:'BONUS_AWARD',sourceId:{in:scope.bonusIds}},{sourceType:'RPV_UPLINE_AWARD',sourceId:{in:scope.rpvIds}},{sourceType:'GLOBAL_POOL_AWARD',sourceId:{in:scope.globalIds}}]},orderBy:{payableEntryId:'asc'}}),
  tx.entitlementReplayPosting.findMany({where:{entitlementKey:{in:sources.map(row=>row.id)}}}),
  companyReservoirCandidates(tx,Math.max(1,sources.length+1),scope),
 ]);
 const recoveries=await tx.bonusRecoveryEvent.findMany({where:{OR:[{bonusAwardId:{in:scope.bonusIds}},{bonusRecoveryEventId:{in:postings.flatMap(row=>row.recoveryId?[row.recoveryId]:[])}}]},include:{applications:true},orderBy:{bonusRecoveryEventId:'asc'}});
 const issues:Array<{code:string;reference:string}>=companyIssues.map(row=>({code:row.code,reference:row.reference}));
 let missingPayables=0;
 for(const source of sources){
  const payable=payables.find(row=>row.sourceType===source.type&&row.sourceId===source.id);
  if(source.expected&&source.mature&&!payable)missingPayables++;
  if(payable&&(source.company||!source.expected||payable.ruleVersionCode!==period.ruleVersionCode||payable.qualificationId!==source.qualificationId||!payable.grossAmount.equals(source.amount)))issues.push({code:'COMPENSATION_PAYABLE_SOURCE_MISMATCH',reference:compensationReference('PAYABLE',payable.payableEntryId)});
  if(payable&&source.type==='BONUS_AWARD'&&!bonuses.find(row=>row.bonusAwardId===source.id)!.lifecycleEvents.some(row=>row.status==='EFFECTIVE'))issues.push({code:'COMPENSATION_PAYABLE_SOURCE_MISMATCH',reference:compensationReference('PAYABLE',payable.payableEntryId)});
  if(payable?.status==='PAID'&&!payable.payoutLineId)issues.push({code:'COMPENSATION_BANK_EVIDENCE_MISMATCH',reference:compensationReference('PAYABLE',payable.payableEntryId)});
 }
 for(const recovery of recoveries){
  const applied=sum(recovery.applications.map(row=>row.amount));
  if(!applied.equals(recovery.recoveredAmount)||!recovery.recoveryAmount.equals(applied.add(recovery.outstandingAmount))||recovery.outstandingAmount.lt(0))issues.push({code:'COMPENSATION_RECOVERY_BALANCE_MISMATCH',reference:compensationReference('RECOVERY',recovery.bonusRecoveryEventId)});
 }
 const payoutIds=payables.flatMap(row=>row.payoutLineId?[row.payoutLineId]:[]);
 const payouts=await tx.payoutBatch.findMany({where:{OR:[{lines:{some:{payoutLineId:{in:payoutIds}}}},{periodStart:period.periodStart,periodEnd:period.periodEnd,lines:{some:{payableEntries:{some:{ruleVersionCode:period.ruleVersionCode}}}}}]},include:{lines:{include:{payableEntries:true,recoveryApplications:true}},paymentResults:true,approvals:true,exportArtifacts:{orderBy:{revision:'asc'}}},orderBy:{createdAt:'asc'}});
 const ownIds=new Set(payables.map(row=>row.payableEntryId));
 let payoutGross=zero(),payoutRecovery=zero(),payoutNet=zero(),bankPaid=zero(),sharedLineCount=0,bankIncomplete=0;
 for(const batch of payouts){
  if(!sum(batch.lines.map(row=>row.grossAmount)).equals(batch.totalGross)||!sum(batch.lines.map(row=>row.recoveryOffset)).equals(batch.totalRecovery)||!sum(batch.lines.map(row=>row.netAmount)).equals(batch.totalNet))issues.push({code:'COMPENSATION_PAYOUT_TOTAL_MISMATCH',reference:compensationReference('PAYOUT',batch.payoutBatchId)});
  if(batch.exportedAt||batch.paymentResults.length||['EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED','PAID'].includes(batch.status)){
   const finance=batch.approvals.find(row=>row.stage==='FINANCE_REVIEW'&&row.decision==='APPROVED'),compliance=batch.approvals.find(row=>row.stage==='COMPLIANCE_REVIEW'&&row.decision==='APPROVED');
   if(!finance?.actorId||!compliance?.actorId||finance.actorId===compliance.actorId)issues.push({code:'COMPENSATION_PAYOUT_APPROVAL_EVIDENCE_MISSING',reference:compensationReference('PAYOUT',batch.payoutBatchId)});
   try{
    const artifact=batch.exportArtifacts.at(-1);if(!artifact)throw new Error('MISSING');
    readFinanceReviewArtifact(artifact);
    const payload=artifact.payloadSnapshot as any,source=artifact.formatVersion==='GENERIC_FINANCE_CSV_V2'?payload.source:payload;
    if(new Date(source.periodStart).getTime()!==batch.periodStart.getTime()||new Date(source.periodEnd).getTime()!==batch.periodEnd.getTime()||!batch.totalGross.eq(source.totalGross)||!batch.totalRecovery.eq(source.totalRecovery)||!batch.totalNet.eq(source.totalNet)||source.lines.length!==batch.lines.length||new Set(source.lines.map((row:any)=>row.payoutLineId)).size!==batch.lines.length||batch.lines.some(line=>!source.lines.some((row:any)=>row.payoutLineId===line.payoutLineId&&line.grossAmount.eq(row.grossAmount)&&line.recoveryOffset.eq(row.recoveryOffset)&&line.netAmount.eq(row.netAmount))))throw new Error('MISMATCH');
   }catch{issues.push({code:'COMPENSATION_PAYOUT_EXPORT_EVIDENCE_INVALID',reference:compensationReference('PAYOUT',batch.payoutBatchId)});}
  }
  for(const line of batch.lines){
   const own=line.payableEntries.filter(row=>ownIds.has(row.payableEntryId));
   // Date-matched legacy batches remain visible, but do not prove source attribution.
   if(!own.length&&payoutIds.length)continue;
   if(!own.length)issues.push({code:'COMPENSATION_PAYOUT_SOURCE_UNATTRIBUTED',reference:compensationReference('PAYOUT-LINE',line.payoutLineId)});
   const confirmations=batch.paymentResults.filter(row=>row.payoutLineId===line.payoutLineId&&row.resultStatus==='PAID');
   const paid=confirmations.reduce((maximum,row)=>Prisma.Decimal.max(maximum,row.paidAmount),zero());
   const applied=sum(line.recoveryApplications.map(row=>row.amount));
   if(line.payableEntries.some(row=>row.qualificationId!==line.recipientQualificationId)||!sum(line.payableEntries.map(row=>row.grossAmount)).equals(line.grossAmount)||!applied.equals(line.recoveryOffset)||!line.grossAmount.sub(line.recoveryOffset).equals(line.netAmount)||paid.gt(line.netAmount))issues.push({code:'COMPENSATION_PAYOUT_LINE_MISMATCH',reference:compensationReference('PAYOUT-LINE',line.payoutLineId)});
   if(own.length!==line.payableEntries.length)sharedLineCount++;
   if(!confirmations.length||!paid.equals(line.netAmount)||own.some(row=>row.status!=='PAID'))bankIncomplete++;
   if(own.some(row=>row.status==='PAID')&&(!confirmations.length||!paid.equals(line.netAmount)))issues.push({code:'COMPENSATION_BANK_EVIDENCE_MISMATCH',reference:compensationReference('PAYOUT-LINE',line.payoutLineId)});
   payoutGross=payoutGross.add(line.grossAmount);payoutRecovery=payoutRecovery.add(line.recoveryOffset);payoutNet=payoutNet.add(line.netAmount);bankPaid=bankPaid.add(paid);
  }
 }
 const reference=compensationPeriodReference(period),jobIds=cohort.jobs.flatMap(row=>[row.periodCloseJobId,periodJobReference(row.periodCloseJobId),compensationReference('PERIOD-JOB',row.periodCloseJobId)]);
 // Resolve stored old and canonical references against exact source membership.
 // A matching period date or recipient is not enough to import another source's exception.
 const references=(kind:string,ids:string[])=>ids.flatMap(id=>[id,compensationReference(kind,id),erpBusinessReference(kind,id)]);
 const exceptions=await tx.operationalException.findMany({where:{status:{not:'RESOLVED'},OR:[
  {sourceType:'COMPENSATION_PERIOD',sourceId:reference},
  {sourceType:'PERIOD_CLOSE_JOB',sourceId:{in:jobIds}},
  {sourceType:'PAYOUT_BATCH',sourceId:{in:references('PAYOUT',payouts.map(row=>row.payoutBatchId))}},
  {sourceType:'PAYABLE_ENTRY',sourceId:{in:references('PAYABLE',payables.map(row=>row.payableEntryId))}},
  {sourceType:'BONUS_RECOVERY',sourceId:{in:references('RECOVERY',recoveries.map(row=>row.bonusRecoveryEventId))}},
  {sourceType:'COMPANY_BONUS_AWARD',sourceId:{in:references('COMPANY-BONUS',scope.bonusIds)}},
  {sourceType:'COMPANY_RPV_AWARD',sourceId:{in:references('COMPANY-RPV',scope.rpvIds)}},
  {sourceType:'COMPANY_GLOBAL_AWARD',sourceId:{in:references('COMPANY-GLOBAL',scope.globalIds)}},
 ]},orderBy:{operationalExceptionId:'asc'}});
 const blocking=exceptions.filter(row=>['HIGH','CRITICAL'].includes(row.severity));
 const pending=sources.filter(row=>row.expected&&!row.mature).length,open=payables.filter(row=>row.status==='OPEN').length,unpaid=payables.filter(row=>row.status!=='PAID').length;
 const destinations=[...bonuses,...rpvs,...globals].flatMap(row=>row.economicDestination?[row.economicDestination]:[]);
 return {reference,sources,payables,payouts,recoveries,issues,exceptions,blocking,missingPayables,pending,open,unpaid,bankIncomplete,sharedLineCount,
  ready:issues.length===0&&blocking.length===0&&missingPayables===0&&pending===0&&unpaid===0&&bankIncomplete===0&&recoveries.every(row=>row.outstandingAmount.eq(0)),
  totals:{recordedTheory:sum(sources.flatMap(row=>row.theory?[row.theory]:[])),globalAllocated:sum(globals.map(row=>row.payableAmount)),award:sum(sources.map(row=>row.amount)),company:sum(destinations.flatMap(row=>row.effects.map(effect=>effect.amountDelta))),recoveryRequired:sum(recoveries.map(row=>row.recoveryAmount)),recoveryApplied:sum(recoveries.map(row=>row.recoveredAmount)),recoveryOutstanding:sum(recoveries.map(row=>row.outstandingAmount)),payable:sum(payables.map(row=>row.grossAmount)),payoutGross,payoutRecovery,payoutNet,bankPaid},
 };
}
