import {BadRequestException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference} from '@ucell/database';
import {compensationPeriodEvidence} from './compensation-period-evidence';
import {compensationFinancialEvidence} from './compensation-financial-evidence';
export type PeriodSourcesInput={periodStart:string;periodEnd:string;ruleVersionCode:string;take?:number;cursor?:string;asOf?:string;awardType?:string;qualificationNo?:string};
const reference=(kind:string,id:string)=>erpBusinessReference(kind,id);
const amount=(value:Prisma.Decimal)=>value.toFixed(4);
@Injectable()
export class CompensationPeriodSourcesService{
 constructor(private readonly db:PrismaService){}
 async list(input:PeriodSourcesInput){
  const period={periodStart:new Date(input.periodStart),periodEnd:new Date(input.periodEnd),ruleVersionCode:input.ruleVersionCode?.trim()},asOf=input.asOf?new Date(input.asOf):new Date(),take=input.take??25;
  if(!Number.isFinite(period.periodStart.getTime())||!Number.isFinite(period.periodEnd.getTime())||period.periodStart>=period.periodEnd||!period.ruleVersionCode||period.ruleVersionCode.length>100||!Number.isFinite(asOf.getTime())||!Number.isInteger(take)||take<1||take>100||input.cursor&&!/^PERIOD-SOURCE-[a-f0-9]{40}$/.test(input.cursor)||input.awardType&&!/^[A-Z_]{1,40}$/.test(input.awardType)||input.qualificationNo&&(!/^[0-9]{1,19}$/.test(input.qualificationNo)||BigInt(input.qualificationNo)>9223372036854775807n))throw new BadRequestException({code:'COMPENSATION_SOURCE_QUERY_INVALID'});
  return this.db.$transaction(async tx=>{
   const cohort=await compensationPeriodEvidence(tx,period),finance=await compensationFinancialEvidence(tx,period,cohort,new Date());
   const selected=input.qualificationNo?await tx.qualification.findUnique({where:{qualificationNo:BigInt(input.qualificationNo)},select:{qualificationId:true}}):null;
   const sources=finance.sources.filter(row=>row.createdAt<=asOf&&(!input.awardType||row.awardType===input.awardType)&&(!input.qualificationNo||row.qualificationId===selected?.qualificationId)).map(row=>({...row,reference:reference('PERIOD-SOURCE',row.type+':'+row.id)})).sort((a,b)=>a.reference.localeCompare(b.reference));
   if(input.cursor&&!sources.some(row=>row.reference===input.cursor))throw new BadRequestException({code:'COMPENSATION_SOURCE_CURSOR_INVALID'});
   const remaining=sources.filter(row=>!input.cursor||row.reference>input.cursor),page=remaining.slice(0,take),qualifications=await tx.qualification.findMany({where:{qualificationId:{in:page.map(row=>row.qualificationId)}},select:{qualificationId:true,qualificationNo:true}});
   const items=page.map(source=>{
    const payable=finance.payables.find(row=>row.sourceType===source.type&&row.sourceId===source.id),postings=finance.postings.filter(row=>row.entitlementKey===source.id),recoveryIds=new Set(postings.flatMap(row=>row.recoveryId?[row.recoveryId]:[]));
    const recoveries=finance.recoveries.filter(row=>source.type==='BONUS_AWARD'&&row.bonusAwardId===source.id||recoveryIds.has(row.bonusRecoveryEventId));
    const batch=payable?.payoutLineId?finance.payouts.find(row=>row.lines.some(line=>line.payoutLineId===payable.payoutLineId)):undefined,line=batch?.lines.find(row=>row.payoutLineId===payable!.payoutLineId),confirmations=batch?.paymentResults.filter(row=>row.payoutLineId===line?.payoutLineId&&row.resultStatus==='PAID')??[];
    const paid=confirmations.reduce((maximum,row)=>Prisma.Decimal.max(maximum,row.paidAmount),new Prisma.Decimal(0)),companyScope=source.type==='BONUS_AWARD'?'COMPANY_BONUS':source.type==='RPV_UPLINE_AWARD'?'COMPANY_RPV':'COMPANY_GLOBAL';
    const financialLink=(scope:string,id:string)=>'/operations-control?scope='+scope+'&reference='+reference(scope,id);
    return {reference:source.reference,sourceType:source.type,awardType:source.awardType,qualificationNo:qualifications.find(row=>row.qualificationId===source.qualificationId)!.qualificationNo.toString(),theory:source.theory?amount(source.theory):null,originalAward:amount(source.amount),mature:source.mature,company:source.company,
     ownershipLink:'/operations-control?company='+companyScope+'&reference='+reference(companyScope.replace('_','-'),source.id),
     replay:{count:postings.length,signedAdjustment:amount(postings.reduce((total,row)=>total.add(row.delta),new Prisma.Decimal(0)))},
     payable:payable?{reference:reference('PAYABLE',payable.payableEntryId),gross:amount(payable.grossAmount),status:payable.status,link:financialLink('PAYABLE',payable.payableEntryId)}:null,
     recoveries:recoveries.map(row=>({reference:reference('RECOVERY',row.bonusRecoveryEventId),required:amount(row.recoveryAmount),applied:amount(row.recoveredAmount),outstanding:amount(row.outstandingAmount),link:financialLink('RECOVERY',row.bonusRecoveryEventId)})),
     payment:batch&&line?{reference:reference('PAYOUT',batch.payoutBatchId),status:batch.status,lineReference:reference('PAYOUT-LINE',line.payoutLineId),gross:amount(line.grossAmount),recoveryOffset:amount(line.recoveryOffset),net:amount(line.netAmount),bankConfirmed:amount(paid),confirmationCount:confirmations.length,sharedSources:line.payableEntries.length,amountScope:'WHOLE_PAYOUT_LINE',link:'/payouts?reference='+reference('PAYOUT',batch.payoutBatchId)}:null};
   });
   return {periodReference:finance.reference,items,nextCursor:remaining.length>take?items.at(-1)!.reference:null,asOf:asOf.toISOString(),dataThrough:new Date().toISOString(),coverage:'CURRENT_PAGE_ONLY',periodSourceCount:sources.length};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
}
