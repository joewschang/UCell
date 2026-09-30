import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference,erpProjectionReference,periodCloseInputState,replayHash,sealErpBusinessProjection,verifyErpBusinessProjection} from '@ucell/database';
import {compensationPeriodEvidence} from '../settlement-jobs/compensation-period-evidence';
import {compensationVolumeEvidence} from '../settlement-jobs/compensation-volume-evidence';
import {compensationFinancialEvidence,compensationPeriodReference} from '../settlement-jobs/compensation-financial-evidence';
import {AuditService} from '../../common/audit/audit.service';

export type CompensationProjectionInput={periodStart:string;periodEnd:string;ruleVersionCode:string;accountingDate:string;currency:string;currencyBasisReference:string;groupByPayoutBatch:boolean};
type Context={actorId:string;requestId:string;correlationId:string};
const businessReference=(value:string)=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/.test(value);
function parse(input:CompensationProjectionInput){
 const period={periodStart:new Date(input.periodStart),periodEnd:new Date(input.periodEnd),ruleVersionCode:input.ruleVersionCode?.trim()};
 if(!Number.isFinite(period.periodStart.getTime())||!Number.isFinite(period.periodEnd.getTime())||period.periodStart>=period.periodEnd||!period.ruleVersionCode||period.ruleVersionCode.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(input.accountingDate)||!Number.isFinite(Date.parse(input.accountingDate))||new Date(input.accountingDate).toISOString().slice(0,10)!==input.accountingDate||!/^[A-Z]{3}$/.test(input.currency)||!businessReference(input.currencyBasisReference)||typeof input.groupByPayoutBatch!=='boolean')throw new UnprocessableEntityException({code:'ERP_COMPENSATION_CONFIGURATION_INVALID'});
 const configuration={periodStart:period.periodStart.toISOString(),periodEnd:period.periodEnd.toISOString(),ruleVersionCode:period.ruleVersionCode,accountingDate:input.accountingDate,currency:input.currency,currencyBasisReference:input.currencyBasisReference,groupByPayoutBatch:input.groupByPayoutBatch};
 return {period,configuration,configurationHash:replayHash(configuration),sourceIdentity:compensationPeriodReference(period)};
}

/** Approved aggregate review snapshot. It is not a corporate journal or a bank-payment allocation. */
@Injectable()
export class ErpCompensationProjectionService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 private async candidate(tx:Prisma.TransactionClient,input:CompensationProjectionInput){
  const parsed=parse(input),{period,configuration,configurationHash,sourceIdentity}=parsed;
  const cohort=await compensationPeriodEvidence(tx,period),inputs=await periodCloseInputState(tx,period),volume=await compensationVolumeEvidence(tx,period,cohort);
  if(!cohort.allComplete||!inputs.ready||!volume.ready)throw new ConflictException({code:'ERP_COMPENSATION_SEALED_PERIOD_REQUIRED'});
  const finance=await compensationFinancialEvidence(tx,period,cohort,new Date());
  if(finance.issues.length||finance.blocking.length||finance.missingPayables||finance.pending)throw new ConflictException({code:'ERP_COMPENSATION_SOURCE_RECONCILIATION_REQUIRED'});
  const sources=new Map(finance.sources.map(row=>[`${row.type}:${row.id}`,row])),batches=new Map(finance.payouts.flatMap(batch=>batch.lines.map(line=>[line.payoutLineId,batch.payoutBatchId] as const)));
  const groups=new Map<string,{metric:string;economicCategory:string;payoutReference:string|null;amount:Prisma.Decimal;sourceCount:number}>();
  const add=(metric:string,category:string,payoutReference:string|null,value:Prisma.Decimal)=>{const key=JSON.stringify([metric,category,payoutReference]);const row=groups.get(key)??{metric,economicCategory:category,payoutReference,amount:new Prisma.Decimal(0),sourceCount:0};row.amount=row.amount.add(value);row.sourceCount++;groups.set(key,row);};
  const payableFacts=finance.payables.map(row=>{
   const source=sources.get(`${row.sourceType}:${row.sourceId}`);if(!source)throw new ConflictException({code:'ERP_COMPENSATION_SOURCE_RECONCILIATION_REQUIRED'});
   const batchId=row.payoutLineId?batches.get(row.payoutLineId):null;
   if(row.payoutLineId&&!batchId)throw new ConflictException({code:'ERP_COMPENSATION_PAYOUT_SOURCE_REQUIRED'});
   const payoutReference=input.groupByPayoutBatch?(batchId?erpBusinessReference('PAYOUT',batchId):'UNBATCHED'):null;
   add('MEMBER_PAYABLE_GROSS',source.awardType,payoutReference,row.grossAmount);
   return {payableEntryId:row.payableEntryId,sourceType:row.sourceType,sourceId:row.sourceId,economicCategory:source.awardType,amount:row.grossAmount.toFixed(4),payoutLineId:row.payoutLineId,payoutBatchId:batchId??null};
  });
  const postings=await tx.entitlementReplayPosting.findMany({where:{recoveryId:{in:finance.recoveries.map(row=>row.bonusRecoveryEventId)}}});
  const recoveryFacts=finance.recoveries.map(row=>{
   const ids=new Set([...(row.bonusAwardId?[row.bonusAwardId]:[]),...postings.filter(post=>post.recoveryId===row.bonusRecoveryEventId).map(post=>post.entitlementKey)]);
   const categories=[...new Set(finance.sources.filter(source=>ids.has(source.id)).map(source=>source.awardType))];
   if(categories.length!==1)throw new ConflictException({code:'ERP_COMPENSATION_RECOVERY_SOURCE_REQUIRED'});
   for(const [metric,value] of [['RECOVERY_REQUIRED',row.recoveryAmount],['RECOVERY_APPLIED',row.recoveredAmount],['RECOVERY_OUTSTANDING',row.outstandingAmount]] as const)add(metric,categories[0],null,value);
   return {recoveryId:row.bonusRecoveryEventId,sourceIds:[...ids].sort(),economicCategory:categories[0],required:row.recoveryAmount.toFixed(4),applied:row.recoveredAmount.toFixed(4),outstanding:row.outstandingAmount.toFixed(4),applications:row.applications.map(app=>({applicationId:app.recoveryApplicationId,payoutLineId:app.payoutLineId,amount:app.amount.toFixed(4)})).sort((a,b)=>a.applicationId.localeCompare(b.applicationId))};
  });
  const aggregates=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>({...row,groupReference:erpBusinessReference('COMPENSATION-GROUP',`${sourceIdentity}:${key}`),amount:row.amount.toFixed(4)}));
  const body={projectionPurpose:'SUBLEDGER_ACCOUNTING_REVIEW',periodReference:sourceIdentity,configuration,configurationHash,dimensions:['COMPENSATION_PERIOD','ECONOMIC_CATEGORY','ACCOUNTING_DATE',...(input.groupByPayoutBatch?['PAYOUT_BATCH']:[])],currency:input.currency,aggregates,totals:{memberPayableGross:finance.totals.payable.toFixed(4),recoveryRequired:finance.totals.recoveryRequired.toFixed(4),recoveryApplied:finance.totals.recoveryApplied.toFixed(4),recoveryOutstanding:finance.totals.recoveryOutstanding.toFixed(4)},paymentScope:'NO_BANK_OR_NET_PAYMENT_ALLOCATION',mappingStatus:'ERP_ACCOUNT_MAPPING_REQUIRED'};
  const drillback={configurationHash,period:{periodStart:period.periodStart.toISOString(),periodEnd:period.periodEnd.toISOString(),ruleVersionCode:period.ruleVersionCode},receipts:cohort.jobs.map(job=>({jobId:job.periodCloseJobId,sourceId:job.receipt!.sourceId,snapshotId:job.receipt!.snapshotId})).sort((a,b)=>a.jobId.localeCompare(b.jobId)),payables:payableFacts.sort((a,b)=>a.payableEntryId.localeCompare(b.payableEntryId)),recoveries:recoveryFacts.sort((a,b)=>a.recoveryId.localeCompare(b.recoveryId))};
  return {...parsed,body,drillback,reviewHash:replayHash({body,drillback}),drillbackHash:replayHash(drillback)};
 }
 async preview(input:CompensationProjectionInput){
  parse(input);return this.db.$transaction(async tx=>{const value=await this.candidate(tx,input);return {projectionReference:erpProjectionReference('COMPENSATION',value.sourceIdentity),reviewHash:value.reviewHash,drillbackHash:value.drillbackHash,expected:value.body};},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
 async approve(input:CompensationProjectionInput&{reviewHash:string;approvalReference:string},context:Context){
  const parsed=parse(input);if(!/^[a-f0-9]{64}$/.test(input.reviewHash)||!businessReference(input.approvalReference))throw new UnprocessableEntityException({code:'ERP_COMPENSATION_APPROVAL_INVALID'});
  for(let attempt=0;;attempt++)try{
   return await this.db.$transaction(async tx=>{
    const ref=erpProjectionReference('COMPENSATION',parsed.sourceIdentity);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ref},0))`;
    const existing=await tx.erpBusinessProjection.findUnique({where:{projectionReference:ref}});
    if(existing){const payload=verifyErpBusinessProjection(existing);if(payload.reviewHash!==input.reviewHash||payload.configurationHash!==parsed.configurationHash||existing.approvalReference!==input.approvalReference)throw new ConflictException({code:'ERP_COMPENSATION_APPROVAL_CONFLICT'});return {projectionReference:ref,payloadHash:existing.payloadHash,replayed:true};}
    const candidate=await this.candidate(tx,input);if(candidate.reviewHash!==input.reviewHash)throw new ConflictException({code:'ERP_COMPENSATION_PREVIEW_STALE'});
    const result=await sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:parsed.sourceIdentity,body:{...candidate.body,reviewHash:candidate.reviewHash},drillback:candidate.drillback,context:{...context,approvalReference:input.approvalReference}});
    await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_COMPENSATION_PROJECTION_APPROVED',entityType:'ERP_BUSINESS_PROJECTION',entityId:result.projection.projectionId,afterData:{projectionReference:ref,payloadHash:result.projection.payloadHash,reviewHash:input.reviewHash,approvalReference:input.approvalReference},requestId:context.requestId,correlationId:context.correlationId});
    return {projectionReference:ref,payloadHash:result.projection.payloadHash,replayed:false};
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
  }catch(error){if(attempt<3&&error instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(error.code))continue;throw error;}
 }
}
