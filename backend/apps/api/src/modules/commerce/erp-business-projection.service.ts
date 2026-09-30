import {ConflictException,ForbiddenException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference,requestErpSalesProjection,requestErpReturnProjection,verifyErpBusinessProjection,verifyErpAccountingMapping,replayHash} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';

type Context={actorId:string;requestId:string;correlationId:string;role?:string};
type ResultInput={resultKey:string;providerReference:string;occurredAt:string;currency:string;amount:string;lines:Array<{lineReference:string;amount:string;quantity:string}>};
const reference=(value:string)=>/^ERP-PROJECTION-[a-f0-9]{40}$/.test(value);
const decimal=(value:string)=>typeof value==='string'&&/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/.test(value);
function number(value:string){if(!/^\d{1,19}$/.test(value)||BigInt(value)>9223372036854775807n)throw new UnprocessableEntityException({code:'ERP_ORDER_REFERENCE_INVALID'});return BigInt(value);}
function publicPayload(payload:any){
 const common={schemaVersion:payload.schemaVersion,format:payload.format,projectionReference:payload.projectionReference,stream:payload.stream,revision:payload.revision,drillbackHash:payload.drillbackHash,previousProjectionReference:payload.previousProjectionReference??null,supplementReasonReference:payload.supplementReasonReference??null};
 if(payload.stream==='COMPENSATION'&&payload.projectionPurpose==='PAYOUT_ACCOUNTING_REVIEW')return {...common,projectionPurpose:payload.projectionPurpose,payoutReference:payload.payoutReference,currency:payload.currency,configurationHash:payload.configurationHash,reviewHash:payload.reviewHash,dimensions:payload.dimensions,configuration:{payoutReference:payload.configuration.payoutReference,periodStart:payload.configuration.periodStart,periodEnd:payload.configuration.periodEnd,accountingDate:payload.configuration.accountingDate,currency:payload.configuration.currency,currencyBasisReference:payload.configuration.currencyBasisReference,groupByEconomicCategory:payload.configuration.groupByEconomicCategory},aggregates:payload.aggregates.map((row:any)=>({groupReference:row.groupReference,metric:row.metric,economicCategory:row.economicCategory,payoutReference:row.payoutReference,amount:row.amount,sourceCount:row.sourceCount})),totals:{memberPayableGross:payload.totals.memberPayableGross,payoutRecoveryOffset:payload.totals.payoutRecoveryOffset,payoutNet:payload.totals.payoutNet,bankPaid:payload.totals.bankPaid},paymentEvidence:{batchStatus:payload.paymentEvidence.batchStatus,lineCount:payload.paymentEvidence.lineCount,confirmedLines:payload.paymentEvidence.confirmedLines,pendingLines:payload.paymentEvidence.pendingLines},paymentScope:payload.paymentScope,mappingStatus:payload.mappingStatus};
 if(payload.stream==='COMPENSATION'&&payload.projectionPurpose==='SUBLEDGER_ACCOUNTING_REVIEW')return {...common,projectionPurpose:payload.projectionPurpose,periodReference:payload.periodReference,currency:payload.currency,configurationHash:payload.configurationHash,reviewHash:payload.reviewHash,dimensions:payload.dimensions,configuration:{periodStart:payload.configuration.periodStart,periodEnd:payload.configuration.periodEnd,ruleVersionCode:payload.configuration.ruleVersionCode,accountingDate:payload.configuration.accountingDate,currency:payload.configuration.currency,currencyBasisReference:payload.configuration.currencyBasisReference,groupByPayoutBatch:payload.configuration.groupByPayoutBatch},aggregates:payload.aggregates.map((row:any)=>({groupReference:row.groupReference,metric:row.metric,economicCategory:row.economicCategory,payoutReference:row.payoutReference,amount:row.amount,sourceCount:row.sourceCount})),totals:{memberPayableGross:payload.totals.memberPayableGross,recoveryRequired:payload.totals.recoveryRequired,recoveryApplied:payload.totals.recoveryApplied,recoveryOutstanding:payload.totals.recoveryOutstanding},paymentScope:payload.paymentScope,mappingStatus:payload.mappingStatus};
 if(!['SALES','RETURN'].includes(payload.stream))return common;
 return {...common,orderNo:payload.orderNo,currency:payload.currency,...(payload.stream==='SALES'?{paidAt:payload.paidAt,grossAmount:payload.grossAmount,discountAmount:payload.discountAmount,netAmount:payload.netAmount}:{returnReference:payload.returnReference,acceptedAt:payload.acceptedAt,amount:payload.amount}),lines:payload.lines.map((line:any)=>({lineReference:line.lineReference,sku:line.sku,quantity:line.quantity,amount:line.amount,...(payload.stream==='SALES'?{unitPrice:line.unitPrice}:{originalLineReference:line.originalLineReference,receivedSerialNos:line.receivedSerialNos})}))};
}
const publicException=(item:any)=>({reference:erpBusinessReference('ERP-EXCEPTION',item.operationalExceptionId),code:['ERP_PROJECTION_REQUIRES_RECONCILIATION','ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT','ERP_PROJECTION_RESULT_MISMATCH'].includes(item.exceptionCode)?item.exceptionCode:'ERP_PROJECTION_REQUIRES_ATTENTION',severity:item.severity,status:item.status});
function safeProjection(row:any){
 const payload=verifyErpBusinessProjection(row),result=row.reconciliations?.[0],attempt=row.dispatch?.attempts?.[0];
 const actual=result?.resultSnapshot as any;
 const mapping=row.accountingMappings?.[0];if(mapping)verifyErpAccountingMapping(row,mapping);
 const status=result?.outcome==='MATCHED'?'RECONCILED':result?'MISMATCH':row.outboxEvent?.processStatus==='DEAD'?'FAILED':attempt?.outcome==='ACCEPTED'?'ACKNOWLEDGED':row.dispatch?'QUEUED':'BLOCKED_EXTERNAL';
 return {projectionReference:row.projectionReference,stream:row.stream,revision:row.revision,formatVersion:row.formatVersion,payloadHash:row.payloadHash,drillbackHash:row.drillbackHash,status,
  expected:publicPayload(payload),actual:actual?{currency:actual.currency,amount:actual.amount,occurredAt:actual.occurredAt,requestPayloadHash:actual.requestPayloadHash,lines:Array.isArray(actual.lines)?actual.lines.map((line:any)=>({lineReference:line.lineReference,amount:line.amount,quantity:line.quantity})):[]}:null,
  provider:row.dispatch?.providerConnectionVersion?.connection?.provider??null,connection:row.dispatch?.providerConnectionVersion?.connection?.connectionKey??null,
  providerReference:row.externalReference?.providerReference??attempt?.providerReference??null,
  attemptCount:row.outboxEvent?.attemptCount??0,outboxStatus:row.outboxEvent?.processStatus??'PENDING',
  mismatchCode:result&&result.outcome!=='MATCHED'?['ERP_PROJECTION_AMOUNT_QUANTITY_MISMATCH','ERP_PROJECTION_RESULT_INCOMPLETE'].includes(result.reasonCode)?result.reasonCode:'ERP_PROJECTION_REQUIRES_ATTENTION':null,
  mapping:mapping?{mappingReference:mapping.mappingReference,revision:mapping.revision,requestHash:mapping.requestHash,approvedAt:mapping.approvedAt.toISOString()}:null,dispatchPinned:!!row.dispatch,
  blockedReason:row.stream==='COMPENSATION'&&!mapping?'ERP_ACCOUNT_MAPPING_REQUIRED':!row.dispatch?'EZTOOL_LIVE_TRANSPORT_UNAVAILABLE':null,
  requestedAt:row.requestedAt.toISOString(),acknowledgedAt:attempt?.outcome==='ACCEPTED'?attempt.recordedAt.toISOString():null,reconciledAt:result?.recordedAt.toISOString()??null,
 };
}
const evidenceInclude={outboxEvent:true,externalReference:true,accountingMappings:{orderBy:{revision:'desc' as const},take:1},dispatch:{include:{attempts:{orderBy:{attemptNumber:'desc' as const},take:1},providerConnectionVersion:{include:{connection:true}}}},reconciliations:{orderBy:[{recordedAt:'desc' as const},{reconciliationId:'desc' as const}],take:1}};

@Injectable()
export class ErpBusinessProjectionService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 private async command<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>){
  try{return await this.db.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:30000});}
  catch(error){if(error instanceof Error&&/^ERP_[A-Z0-9_]+$/.test(error.message))throw new ConflictException({code:error.message});throw error;}
 }
 async orderSources(orderNo:string){
  const order=await this.db.order.findUnique({where:{orderNo:number(orderNo)},include:{returns:{orderBy:[{occurredAt:'desc'},{returnCaseId:'asc'}]}}});
  if(!order)throw new ConflictException({code:'ERP_ORDER_NOT_FOUND'});
  return {orderNo:order.orderNo.toString(),status:order.status,returns:order.returns.map(row=>({returnReference:erpBusinessReference('RETURN',row.returnCaseId),status:row.status,occurredAt:row.occurredAt.toISOString()}))};
 }
 async sales(orderNo:string,context:Context){
  number(orderNo);return this.command(async tx=>{
   const result=await requestErpSalesProjection(tx,orderNo,context);
   if(!result.replayed)await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_SALES_PROJECTION_REQUESTED',entityType:'ERP_BUSINESS_PROJECTION',entityId:result.projection.projectionId,afterData:{projectionReference:result.projection.projectionReference,payloadHash:result.projection.payloadHash},requestId:context.requestId,correlationId:context.correlationId});
   return {projectionReference:result.projection.projectionReference,payloadHash:result.projection.payloadHash,replayed:result.replayed};
  });
 }
 async returned(orderNo:string,returnReference:string,context:Context){
  const orderNumber=number(orderNo);if(!/^RETURN-[a-f0-9]{40}$/.test(returnReference))throw new UnprocessableEntityException({code:'ERP_RETURN_REFERENCE_INVALID'});
  return this.command(async tx=>{
   const returns=await tx.returnCase.findMany({where:{order:{orderNo:orderNumber}}}),source=returns.find(row=>erpBusinessReference('RETURN',row.returnCaseId)===returnReference);
   if(!source)throw new ConflictException({code:'ERP_RETURN_NOT_FOUND'});
   const result=await requestErpReturnProjection(tx,source.returnCaseId,context);
   if(!result.replayed)await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_RETURN_PROJECTION_REQUESTED',entityType:'ERP_BUSINESS_PROJECTION',entityId:result.projection.projectionId,afterData:{projectionReference:result.projection.projectionReference,payloadHash:result.projection.payloadHash},requestId:context.requestId,correlationId:context.correlationId});
   return {projectionReference:result.projection.projectionReference,payloadHash:result.projection.payloadHash,replayed:result.replayed};
  });
 }
 async list(input:{stream?:string;take?:number;cursor?:string;asOf?:string},allowCompensation=true){
  if(input.stream==='COMPENSATION'&&!allowCompensation)throw new ForbiddenException({code:'ERP_COMPENSATION_READ_FORBIDDEN'});
  const take=input.take??50,asOf=input.asOf?new Date(input.asOf):new Date();if(!Number.isFinite(asOf.getTime())||!Number.isInteger(take)||take<1||take>200||input.stream&&!['SALES','RETURN','COMPENSATION'].includes(input.stream)||input.cursor&&!reference(input.cursor))throw new UnprocessableEntityException({code:'ERP_PROJECTION_QUERY_INVALID'});
  return this.db.$transaction(async tx=>{
   const rows=await tx.erpBusinessProjection.findMany({where:{requestedAt:{lte:asOf},...(input.stream?{stream:input.stream}:!allowCompensation?{stream:{in:['SALES','RETURN']}}:{}),...(input.cursor?{projectionReference:{gt:input.cursor}}:{})},include:evidenceInclude,orderBy:{projectionReference:'asc'},take:take+1});
   const items=rows.slice(0,take).map(safeProjection),exceptions=await tx.operationalException.findMany({where:{sourceType:'ERP_BUSINESS_PROJECTION',sourceId:{in:items.map(row=>row.projectionReference)},status:{not:'RESOLVED'}}});
   return {items:items.map(row=>({...row,exceptions:exceptions.filter(item=>item.sourceId===row.projectionReference).map(item=>({reference:erpBusinessReference('ERP-EXCEPTION',item.operationalExceptionId),code:['ERP_PROJECTION_REQUIRES_RECONCILIATION','ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT','ERP_PROJECTION_RESULT_MISMATCH'].includes(item.exceptionCode)?item.exceptionCode:'ERP_PROJECTION_REQUIRES_ATTENTION',severity:item.severity,status:item.status}))})),nextCursor:rows.length>take?items.at(-1)!.projectionReference:null,asOf:asOf.toISOString(),dataThrough:new Date().toISOString(),liveTransportStatus:'BLOCKED_EXTERNAL'};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async detail(projectionReference:string,allowCompensation=true){
  if(!reference(projectionReference))throw new UnprocessableEntityException({code:'ERP_PROJECTION_REFERENCE_INVALID'});
  return this.db.$transaction(async tx=>{
   const row=await tx.erpBusinessProjection.findUnique({where:{projectionReference},include:evidenceInclude});if(!row)throw new ConflictException({code:'ERP_PROJECTION_NOT_FOUND'});
   if(row.stream==='COMPENSATION'&&!allowCompensation)throw new ForbiddenException({code:'ERP_COMPENSATION_READ_FORBIDDEN'});
   const output=safeProjection(row),drillback=row.drillbackSnapshot as any;
   const exceptions=await tx.operationalException.findMany({where:{sourceType:'ERP_BUSINESS_PROJECTION',sourceId:projectionReference,status:{not:'RESOLVED'}}});
   return {...output,exceptions:exceptions.map(publicException),drillback:{verified:true,hash:row.drillbackHash,orderNo:(output.expected as any).orderNo??null,sourceReference:erpBusinessReference(row.stream==='SALES'?'ORDER':row.stream==='RETURN'?'RETURN':'COMPENSATION-SOURCE',row.sourceIdentity),lines:Array.isArray(drillback.lines)?drillback.lines.map((line:any)=>({lineReference:line.lineReference,originalLineReference:line.originalLineReference??null,sku:line.sku,quantity:line.quantity,amount:line.amount})):[]},dataThrough:new Date().toISOString()};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async retry(projectionReference:string,input:{retryKey:string;reasonReference:string},context:Context){
  if(!reference(projectionReference)||!/^[a-f0-9-]{36}$/i.test(input.retryKey)||!/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/.test(input.reasonReference))throw new UnprocessableEntityException({code:'ERP_PROJECTION_RETRY_INVALID'});
  return this.command(async tx=>{
   await tx.$queryRaw`SELECT projection_id FROM commerce.erp_business_projection WHERE projection_reference=${projectionReference} FOR UPDATE`;
   const row=await tx.erpBusinessProjection.findUnique({where:{projectionReference},include:{outboxEvent:true,externalReference:true}});if(!row)throw new ConflictException({code:'ERP_PROJECTION_NOT_FOUND'});
   if(row.stream==='COMPENSATION'&&context.role==='ORDER_OPS')throw new ForbiddenException({code:'ERP_COMPENSATION_WRITE_FORBIDDEN'});
   verifyErpBusinessProjection(row);
   const previous=await tx.auditEvent.findFirst({where:{entityType:'ERP_BUSINESS_PROJECTION',entityId:row.projectionId,action:'ERP_PROJECTION_RETRY_REQUESTED',afterData:{path:['retryKey'],equals:input.retryKey}}});
   if(previous){if((previous.afterData as any)?.reasonReference!==input.reasonReference)throw new ConflictException({code:'ERP_PROJECTION_RETRY_CONFLICT'});return {projectionReference,replayed:true};}
   if(row.outboxEvent.processStatus!=='DEAD'||row.externalReference)throw new ConflictException({code:'ERP_PROJECTION_RETRY_NOT_ALLOWED'});
   const updated=await tx.outboxEvent.updateMany({where:{outboxEventId:row.outboxEventId,processStatus:'DEAD',attemptCount:row.outboxEvent.attemptCount},data:{processStatus:'PENDING',availableAt:new Date(),lastError:null}});
   if(updated.count!==1)throw new ConflictException({code:'ERP_PROJECTION_RETRY_NOT_ALLOWED'});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_PROJECTION_RETRY_REQUESTED',entityType:'ERP_BUSINESS_PROJECTION',entityId:row.projectionId,afterData:{projectionReference,retryKey:input.retryKey,reasonReference:input.reasonReference,previousAttemptCount:row.outboxEvent.attemptCount},requestId:context.requestId,correlationId:context.correlationId});
   return {projectionReference,replayed:false};
  });
 }
 async sources(projectionReference:string,input:{kind?:string;take?:number;cursor?:string}){
  const kind=input.kind??'PAYABLE',take=input.take??50;
  if(!reference(projectionReference)||!['PAYABLE','RECOVERY','PAYMENT'].includes(kind)||!Number.isInteger(take)||take<1||take>200||input.cursor&&!/^(PAYABLE|RECOVERY|PAYMENT-LINE)-[a-f0-9]{40}$/.test(input.cursor))throw new UnprocessableEntityException({code:'ERP_PROJECTION_SOURCE_QUERY_INVALID'});
  const row=await this.db.erpBusinessProjection.findUnique({where:{projectionReference}});if(!row)throw new ConflictException({code:'ERP_PROJECTION_NOT_FOUND'});
  const payload=verifyErpBusinessProjection(row);if(row.stream!=='COMPENSATION')throw new UnprocessableEntityException({code:'ERP_PROJECTION_SOURCE_KIND_UNSUPPORTED'});const snapshot=row.drillbackSnapshot as any,raw=kind==='PAYABLE'?snapshot.payables:kind==='PAYMENT'?(payload.projectionPurpose==='PAYOUT_ACCOUNTING_REVIEW'?snapshot.lines:[]):snapshot.recoveries;
  const rows=(Array.isArray(raw)?raw:[]).map((item:any)=>kind==='PAYMENT'?{reference:erpBusinessReference('PAYMENT-LINE',item.payoutLineId),economicCategory:'WHOLE_LINE',amount:item.gross,recovery:item.recovery,net:item.net,bankPaid:item.bankPaid,bankResultCount:item.results.length}:kind==='PAYABLE'?{reference:erpBusinessReference('PAYABLE',item.payableEntryId),economicCategory:item.economicCategory,sourceType:item.sourceType,sourceReference:erpBusinessReference(item.sourceType,item.sourceId),amount:item.amount,payoutReference:item.payoutBatchId?erpBusinessReference('PAYOUT',item.payoutBatchId):null}:{reference:erpBusinessReference('RECOVERY',item.recoveryId),economicCategory:item.economicCategory,required:item.required,applied:item.applied,outstanding:item.outstanding,applicationCount:item.applications.length}).sort((a:any,b:any)=>a.reference.localeCompare(b.reference));
  const offset=input.cursor?rows.findIndex((item:any)=>item.reference===input.cursor)+1:0;if(input.cursor&&offset===0)throw new UnprocessableEntityException({code:'ERP_PROJECTION_SOURCE_CURSOR_INVALID'});
  const items=rows.slice(offset,offset+take);return {projectionReference,kind,drillbackHash:row.drillbackHash,verified:true,items,total:rows.length,nextCursor:offset+take<rows.length?items.at(-1)!.reference:null,asOf:row.requestedAt.toISOString()};
 }
 async reconcile(projectionReference:string,input:ResultInput,context:Context){
  if(!reference(projectionReference)||!input||!input.resultKey||input.resultKey.length>200||!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(input.providerReference)||!Number.isFinite(Date.parse(input.occurredAt))||!/^[A-Z]{3}$/.test(input.currency)||!decimal(input.amount)||!Array.isArray(input.lines)||input.lines.length>1000||input.lines.some(row=>!row||!/^(ORDER|RETURN)-LINE-[a-f0-9]{40}$/.test(row.lineReference)||!decimal(row.amount)||!decimal(row.quantity))||new Set(input.lines.map(row=>row.lineReference)).size!==input.lines.length)throw new UnprocessableEntityException({code:'ERP_PROJECTION_RESULT_INVALID'});
  const actual={schemaVersion:1,reportedVia:'CONTROLLED_ADMIN',providerReference:input.providerReference,currency:input.currency,amount:new Prisma.Decimal(input.amount).toFixed(4),occurredAt:new Date(input.occurredAt).toISOString(),lines:input.lines.map(row=>({lineReference:row.lineReference,amount:new Prisma.Decimal(row.amount).toFixed(4),quantity:new Prisma.Decimal(row.quantity).toFixed(4)})).sort((a,b)=>a.lineReference.localeCompare(b.lineReference))};
  return this.command(async tx=>{
   await tx.$queryRaw`SELECT projection_id FROM commerce.erp_business_projection WHERE projection_reference=${projectionReference} FOR UPDATE`;
   const projection=await tx.erpBusinessProjection.findUnique({where:{projectionReference},include:evidenceInclude});if(!projection)throw new ConflictException({code:'ERP_PROJECTION_NOT_FOUND'});
   const expected=verifyErpBusinessProjection(projection);if(projection.stream==='COMPENSATION')throw new ConflictException({code:'ERP_ACCOUNT_MAPPING_REQUIRED'});
   if(projection.outboxEvent.processStatus!=='PROCESSED'||!projection.externalReference||projection.externalReference.providerReference!==input.providerReference)throw new ConflictException({code:'ERP_ACKNOWLEDGED_REFERENCE_REQUIRED'});
   const snapshot={...actual,requestPayloadHash:projection.payloadHash},resultHash=replayHash(snapshot);
   const previous=await tx.erpProjectionReconciliation.findUnique({where:{projectionId_resultKey:{projectionId:projection.projectionId,resultKey:input.resultKey}}});
   if(previous){if(previous.resultHash!==resultHash)throw new ConflictException({code:'ERP_PROJECTION_RESULT_CONFLICT'});return {outcome:previous.outcome,resultHash,replayed:true};}
   const expectedAmount=projection.stream==='SALES'?expected.netAmount:expected.amount;
   const mismatch=expected.currency!==actual.currency||new Prisma.Decimal(actual.amount).gt(expectedAmount)||actual.lines.some(row=>{const line=expected.lines.find((item:any)=>item.lineReference===row.lineReference);return !line||new Prisma.Decimal(row.quantity).gt(line.quantity)||new Prisma.Decimal(row.amount).gt(line.amount);});
   const matched=!mismatch&&new Prisma.Decimal(actual.amount).eq(expectedAmount)&&actual.lines.length===expected.lines.length&&actual.lines.every(row=>{const line=expected.lines.find((line:any)=>line.lineReference===row.lineReference);return new Prisma.Decimal(row.quantity).eq(line.quantity)&&new Prisma.Decimal(row.amount).eq(line.amount);});
   const outcome=mismatch?'MISMATCH':matched?'MATCHED':'PARTIAL',reasonCode=matched?'ERP_PROJECTION_EXACT_MATCH':mismatch?'ERP_PROJECTION_AMOUNT_QUANTITY_MISMATCH':'ERP_PROJECTION_RESULT_INCOMPLETE';
   await tx.erpProjectionReconciliation.create({data:{projectionId:projection.projectionId,resultKey:input.resultKey,resultHash,outcome,reasonCode,providerReference:input.providerReference,resultSnapshot:snapshot,occurredAt:new Date(input.occurredAt),reportedByActor:context.actorId}});
   if(!matched){const source={sourceType:'ERP_BUSINESS_PROJECTION',sourceId:projectionReference,exceptionCode:'ERP_PROJECTION_RESULT_MISMATCH'};await tx.operationalException.upsert({where:{sourceType_sourceId_exceptionCode:source},update:{status:'OPEN',evidenceHash:resultHash,resolvedAt:null,resolvedByActor:null,resolutionNote:null},create:{...source,severity:'HIGH',summary:'ERP 金額或數量尚未與 UCell 投影一致。',evidenceHash:resultHash,traceId:context.correlationId}});}
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_PROJECTION_RECONCILED',entityType:'ERP_BUSINESS_PROJECTION',entityId:projection.projectionId,afterData:{projectionReference,outcome,resultHash},requestId:context.requestId,correlationId:context.correlationId});
   return {outcome,resultHash,replayed:false};
  });
 }
}
