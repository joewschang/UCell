import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference,erpProjectionReference,replayHash,sealErpBusinessProjection,verifyErpBusinessProjection} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {readFinanceReviewArtifact} from '../admin-operations/payout-review-artifact';
import {compensationReference} from '../settlement-jobs/compensation-financial-evidence';

export type PaymentProjectionInput={payoutReference:string;periodStart:string;periodEnd:string;accountingDate:string;currency:string;currencyBasisReference:string;groupByEconomicCategory:boolean};
type Context={actorId:string;requestId:string;correlationId:string};
function fail(code:string):never{throw new ConflictException({code});}
const sum=(values:Prisma.Decimal[])=>values.reduce((total,value)=>total.add(value),new Prisma.Decimal(0));
const validReference=(value:string)=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/.test(value);
// Same canonical {id,kind} byte sequence as erpBusinessReference; no UUID crosses the API boundary.
const payoutRefSql=Prisma.sql`'PAYOUT-' || left(encode(sha256(convert_to('{"id":"' || payout_batch_id::text || '","kind":"PAYOUT"}', 'UTF8')), 'hex'),40)`;
function period(input:{periodStart:string;periodEnd:string}){const start=new Date(input.periodStart),end=new Date(input.periodEnd);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)throw new UnprocessableEntityException({code:'ERP_PAYOUT_PERIOD_INVALID'});return {periodStart:start,periodEnd:end};}
function configuration(input:PaymentProjectionInput){const range=period(input);if(!/^PAYOUT-[a-f0-9]{40}$/.test(input.payoutReference)||!/^\d{4}-\d{2}-\d{2}$/.test(input.accountingDate)||!Number.isFinite(Date.parse(input.accountingDate))||new Date(input.accountingDate).toISOString().slice(0,10)!==input.accountingDate||!/^[A-Z]{3}$/.test(input.currency)||!validReference(input.currencyBasisReference)||typeof input.groupByEconomicCategory!=='boolean')throw new UnprocessableEntityException({code:'ERP_PAYMENT_CONFIGURATION_INVALID'});return {payoutReference:input.payoutReference,accountingDate:input.accountingDate,currency:input.currency,currencyBasisReference:input.currencyBasisReference,groupByEconomicCategory:input.groupByEconomicCategory,periodStart:range.periodStart.toISOString(),periodEnd:range.periodEnd.toISOString()};}

/** Whole-batch accounting review; never splits net payment or recovery across source award periods. */
@Injectable()
export class ErpPaymentProjectionService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 async batches(input:{periodStart:string;periodEnd:string;cursor?:string;take?:number}){
  const range=period(input),take=input.take??50;if(!Number.isInteger(take)||take<1||take>200||input.cursor&&!/^PAYOUT-[a-f0-9]{40}$/.test(input.cursor))throw new UnprocessableEntityException({code:'ERP_PAYOUT_QUERY_INVALID'});
  const rows=await this.db.$queryRaw<Array<{reference:string;periodStart:Date;periodEnd:Date;status:string;gross:Prisma.Decimal;recovery:Prisma.Decimal;net:Prisma.Decimal}>>`SELECT ${payoutRefSql} AS reference,period_start AS "periodStart",period_end AS "periodEnd",status::text,gross.total_gross AS gross,total_recovery AS recovery,total_net AS net FROM ledger.payout_batch gross WHERE period_start=${range.periodStart} AND period_end=${range.periodEnd} AND (${payoutRefSql})>${input.cursor??''} ORDER BY (${payoutRefSql}) COLLATE "C" LIMIT ${take+1}`;
  const page=rows.slice(0,take);return {items:page.map(row=>({payoutReference:row.reference,periodStart:row.periodStart.toISOString(),periodEnd:row.periodEnd.toISOString(),status:row.status,gross:row.gross.toFixed(4),recovery:row.recovery.toFixed(4),net:row.net.toFixed(4)})),nextCursor:rows.length>take?page.at(-1)!.reference:null,dataThrough:new Date().toISOString()};
 }
 private async candidate(tx:Prisma.TransactionClient,input:PaymentProjectionInput){
  const config=configuration(input),range=period(input),found=await tx.$queryRaw<Array<{id:string}>>`SELECT payout_batch_id AS id FROM ledger.payout_batch WHERE period_start=${range.periodStart} AND period_end=${range.periodEnd} AND (${payoutRefSql})=${input.payoutReference} LIMIT 2`;
  if(found.length!==1)fail('ERP_PAYOUT_NOT_FOUND');const id=found[0].id;
  const batch=await tx.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:id},include:{lines:{include:{payableEntries:true,recoveryApplications:true}},approvals:true,exportArtifacts:{orderBy:{revision:'desc'},take:1},paymentResults:true}});
  if(await tx.operationalException.count({where:{sourceType:'PAYOUT_BATCH',sourceId:{in:[batch.payoutBatchId,input.payoutReference,compensationReference('PAYOUT',batch.payoutBatchId)]},status:{not:'RESOLVED'},severity:{in:['HIGH','CRITICAL']}}}))fail('ERP_PAYOUT_BLOCKING_EXCEPTION');
  const finance=batch.approvals.find(row=>row.stage==='FINANCE_REVIEW'&&row.decision==='APPROVED'),compliance=batch.approvals.find(row=>row.stage==='COMPLIANCE_REVIEW'&&row.decision==='APPROVED');
  if(!finance?.actorId||!compliance?.actorId||finance.actorId===compliance.actorId||!batch.lines.length||!['EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED','PAID'].includes(batch.status))fail('ERP_PAYOUT_APPROVAL_REQUIRED');
  const artifact=batch.exportArtifacts[0];if(!artifact)fail('ERP_PAYOUT_EXPORT_EVIDENCE_REQUIRED');readFinanceReviewArtifact(artifact);
  const document=artifact.payloadSnapshot as any,exported=artifact.formatVersion==='GENERIC_FINANCE_CSV_V2'?document.source:document;
  if(exported.periodStart!==batch.periodStart.toISOString()||exported.periodEnd!==batch.periodEnd.toISOString()||!batch.totalGross.eq(exported.totalGross)||!batch.totalRecovery.eq(exported.totalRecovery)||!batch.totalNet.eq(exported.totalNet)||exported.lines.length!==batch.lines.length||new Set(exported.lines.map((row:any)=>row.payoutLineId)).size!==batch.lines.length)fail('ERP_PAYOUT_EXPORT_EVIDENCE_INVALID');
  const payables=batch.lines.flatMap(line=>line.payableEntries),ids=(type:string)=>payables.filter(row=>row.sourceType===type).map(row=>row.sourceId);
  const [bonuses,rpvs,globals]=await Promise.all([
   tx.bonusAward.findMany({where:{bonusAwardId:{in:ids('BONUS_AWARD')}},include:{economicDestination:true,lifecycleEvents:true}}),
   tx.rpvUplineAwardEvent.findMany({where:{rpvAwardEventId:{in:ids('RPV_UPLINE_AWARD')}},include:{economicDestination:true}}),
   tx.globalPoolAward.findMany({where:{globalPoolAwardId:{in:ids('GLOBAL_POOL_AWARD')}},include:{economicDestination:true,settlement:true}}),
  ]);
  for(const payable of payables){
   const source=payable.sourceType==='BONUS_AWARD'?bonuses.find(row=>row.bonusAwardId===payable.sourceId):payable.sourceType==='RPV_UPLINE_AWARD'?rpvs.find(row=>row.rpvAwardEventId===payable.sourceId):payable.sourceType==='GLOBAL_POOL_AWARD'?globals.find(row=>row.globalPoolAwardId===payable.sourceId):undefined;
   if(!source||source.economicDestination||!source.payableAmount.eq(payable.grossAmount)||('recipientQualificationId' in source?source.recipientQualificationId:source.qualificationId)!==payable.qualificationId||('ruleVersionCode' in source&&source.ruleVersionCode!==payable.ruleVersionCode)||('lifecycleEvents' in source&&!source.lifecycleEvents.some(row=>row.status==='EFFECTIVE')))fail('ERP_PAYOUT_SOURCE_INVALID');
   if('settlement' in source&&source.settlement.ruleVersionCode!==payable.ruleVersionCode||'pendingUntil' in source&&source.pendingUntil>new Date())fail('ERP_PAYOUT_SOURCE_INVALID');
   if(payable.awardType!==('awardType' in source?source.awardType:'settlement' in source?'GLOBAL':'RPV'))fail('ERP_PAYOUT_SOURCE_INVALID');
  }
  const groups=new Map<string,{metric:string;economicCategory:string;amount:Prisma.Decimal;sourceCount:number}>(),add=(metric:string,category:string,value:Prisma.Decimal)=>{const key=`${metric}:${category}`,row=groups.get(key)??{metric,economicCategory:category,amount:new Prisma.Decimal(0),sourceCount:0};row.amount=row.amount.add(value);row.sourceCount++;groups.set(key,row);};
  let paidTotal=new Prisma.Decimal(0);
  const lines=batch.lines.map(line=>{
   const snapshot=exported.lines.find((row:any)=>row.payoutLineId===line.payoutLineId);if(!snapshot||!line.grossAmount.eq(snapshot.grossAmount)||!line.recoveryOffset.eq(snapshot.recoveryOffset)||!line.netAmount.eq(snapshot.netAmount))fail('ERP_PAYOUT_EXPORT_EVIDENCE_INVALID');
   if(!sum(line.payableEntries.map(row=>row.grossAmount)).eq(line.grossAmount)||!sum(line.recoveryApplications.map(row=>row.amount)).eq(line.recoveryOffset)||!line.grossAmount.sub(line.recoveryOffset).eq(line.netAmount)||line.payableEntries.some(row=>row.qualificationId!==line.recipientQualificationId))fail('ERP_PAYOUT_AMOUNT_RECONCILIATION_REQUIRED');
   const results=batch.paymentResults.filter(row=>row.payoutLineId===line.payoutLineId),confirmed=results.filter(row=>row.resultStatus==='PAID'),paid=confirmed.reduce((maximum,row)=>Prisma.Decimal.max(maximum,row.paidAmount),new Prisma.Decimal(0));
   if(paid.gt(line.netAmount)||line.payableEntries.some(row=>row.status==='PAID')&&(!confirmed.length||!paid.eq(line.netAmount))||batch.status==='PAID'&&(!confirmed.length||!paid.eq(line.netAmount)))fail('ERP_PAYOUT_BANK_EVIDENCE_INVALID');
   paidTotal=paidTotal.add(paid);
   for(const payable of line.payableEntries)add('MEMBER_PAYABLE_GROSS',input.groupByEconomicCategory?payable.awardType:'ALL',payable.grossAmount);
   add('PAYOUT_RECOVERY_OFFSET','ALL',line.recoveryOffset);add('PAYOUT_NET','ALL',line.netAmount);add('BANK_PAID','ALL',paid);
   return {payoutLineId:line.payoutLineId,gross:line.grossAmount.toFixed(4),recovery:line.recoveryOffset.toFixed(4),net:line.netAmount.toFixed(4),bankPaid:paid.toFixed(4),payables:line.payableEntries.map(row=>({payableEntryId:row.payableEntryId,sourceType:row.sourceType,sourceId:row.sourceId,ruleVersionCode:row.ruleVersionCode,amount:row.grossAmount.toFixed(4),economicCategory:row.awardType})).sort((a,b)=>a.payableEntryId.localeCompare(b.payableEntryId)),applications:line.recoveryApplications.map(row=>({applicationId:row.recoveryApplicationId,recoveryId:row.bonusRecoveryEventId,amount:row.amount.toFixed(4)})).sort((a,b)=>a.applicationId.localeCompare(b.applicationId)),results:results.map(row=>({resultId:row.payoutPaymentResultId,status:row.resultStatus,paidAmount:row.paidAmount.toFixed(4),occurredAt:row.occurredAt.toISOString()})).sort((a,b)=>a.resultId.localeCompare(b.resultId))};
  }).sort((a,b)=>a.payoutLineId.localeCompare(b.payoutLineId));
  if(!sum(batch.lines.map(row=>row.grossAmount)).eq(batch.totalGross)||!sum(batch.lines.map(row=>row.recoveryOffset)).eq(batch.totalRecovery)||!sum(batch.lines.map(row=>row.netAmount)).eq(batch.totalNet))fail('ERP_PAYOUT_AMOUNT_RECONCILIATION_REQUIRED');
  const sourceIdentity=`PAYMENT:${input.payoutReference}`,configurationHash=replayHash(config),aggregates=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>({...row,groupReference:erpBusinessReference('PAYMENT-GROUP',`${sourceIdentity}:${key}`),payoutReference:input.payoutReference,amount:row.amount.toFixed(4)}));
  const confirmedLines=lines.filter(line=>line.results.some(row=>row.status==='PAID')&&new Prisma.Decimal(line.bankPaid).eq(line.net)).length;
  const body={projectionPurpose:'PAYOUT_ACCOUNTING_REVIEW',payoutReference:input.payoutReference,configuration:config,configurationHash,dimensions:['PAYOUT_BATCH','ACCOUNTING_DATE',...(input.groupByEconomicCategory?['ECONOMIC_CATEGORY_FOR_GROSS_ONLY']:[])],currency:input.currency,aggregates,totals:{memberPayableGross:batch.totalGross.toFixed(4),payoutRecoveryOffset:batch.totalRecovery.toFixed(4),payoutNet:batch.totalNet.toFixed(4),bankPaid:paidTotal.toFixed(4)},paymentEvidence:{batchStatus:batch.status,lineCount:lines.length,confirmedLines,pendingLines:lines.length-confirmedLines},paymentScope:'WHOLE_PAYOUT_BATCH_NO_AWARD_PERIOD_ALLOCATION',mappingStatus:'ERP_ACCOUNT_MAPPING_REQUIRED'};
  const drillback={configurationHash,payoutBatchId:batch.payoutBatchId,approvalIds:[finance!.payoutApprovalId,compliance!.payoutApprovalId].sort(),artifact:{artifactId:artifact.payoutExportArtifactId,hash:artifact.contentHash,revision:artifact.revision},lines,payables:lines.flatMap(line=>line.payables.map(row=>({...row,payoutLineId:line.payoutLineId,payoutBatchId:batch.payoutBatchId}))),recoveries:[]};
  return {body,drillback,sourceIdentity,configurationHash,reviewHash:replayHash({body,drillback}),drillbackHash:replayHash(drillback)};
 }
 async preview(input:PaymentProjectionInput){configuration(input);return this.db.$transaction(async tx=>{const value=await this.candidate(tx,input);return {projectionReference:erpProjectionReference('COMPENSATION',value.sourceIdentity),reviewHash:value.reviewHash,drillbackHash:value.drillbackHash,expected:value.body};},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});}
 async approve(input:PaymentProjectionInput&{reviewHash:string;approvalReference:string},context:Context){
  const config=configuration(input);if(!/^[a-f0-9]{64}$/.test(input.reviewHash)||!validReference(input.approvalReference))throw new UnprocessableEntityException({code:'ERP_PAYMENT_APPROVAL_INVALID'});
  for(let attempt=0;;attempt++)try{return await this.db.$transaction(async tx=>{
   const sourceIdentity=`PAYMENT:${input.payoutReference}`,ref=erpProjectionReference('COMPENSATION',sourceIdentity);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ref},0))`;
   const existing=await tx.erpBusinessProjection.findUnique({where:{projectionReference:ref}});if(existing){const payload=verifyErpBusinessProjection(existing);if(payload.reviewHash!==input.reviewHash||payload.configurationHash!==replayHash(config)||existing.approvalReference!==input.approvalReference)fail('ERP_PAYMENT_APPROVAL_CONFLICT');return {projectionReference:ref,payloadHash:existing.payloadHash,replayed:true};}
   const value=await this.candidate(tx,input);if(value.reviewHash!==input.reviewHash)fail('ERP_PAYMENT_PREVIEW_STALE');
   const result=await sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity,body:{...value.body,reviewHash:value.reviewHash},drillback:value.drillback,context:{...context,approvalReference:input.approvalReference}});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_PAYMENT_PROJECTION_APPROVED',entityType:'ERP_BUSINESS_PROJECTION',entityId:result.projection.projectionId,afterData:{projectionReference:ref,reviewHash:input.reviewHash,payloadHash:result.projection.payloadHash,approvalReference:input.approvalReference},requestId:context.requestId,correlationId:context.correlationId});return {projectionReference:ref,payloadHash:result.projection.payloadHash,replayed:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});}catch(error){if(attempt<3&&error instanceof Prisma.PrismaClientKnownRequestError&&['P2002','P2034'].includes(error.code))continue;throw error;}
 }
}
