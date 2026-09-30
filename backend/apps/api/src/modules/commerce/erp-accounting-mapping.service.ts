import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,AccountingMappingConfiguration,previewErpAccountingMapping,approveErpAccountingMapping,verifyErpAccountingMapping,replayHash} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
@Injectable()
export class ErpAccountingMappingService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 private async run<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>,read=false){try{return await this.db.$transaction(work,{isolationLevel:read?Prisma.TransactionIsolationLevel.RepeatableRead:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:30000});}catch(error){if(error instanceof Error&&/^ERP_[A-Z0-9_]+$/.test(error.message))throw new ConflictException({code:error.message});throw error;}}
 async connections(){const now=new Date(),rows=await this.db.providerConnectionVersion.findMany({where:{connection:{domain:'ERP',status:'ACTIVE'},approvalReference:{not:null},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},include:{connection:true},orderBy:[{providerConnectionId:'asc'},{version:'desc'}],take:101});return {items:rows.slice(0,100).map(row=>({connectionKey:row.connection.connectionKey,provider:row.connection.provider,version:row.version,environment:row.environment,configHash:row.configHash})),truncated:rows.length>100};}
 preview(reference:string,input:AccountingMappingConfiguration){return this.run(async tx=>{const value=await previewErpAccountingMapping(tx,reference,input);return {mappingReference:value.mappingReference,revision:value.revision,reviewHash:value.reviewHash,request:value.request};},true);}
 approve(reference:string,input:AccountingMappingConfiguration&{reviewHash:string;approvalReference:string},context:{actorId:string;requestId:string;correlationId:string}){return this.run(async tx=>{
  const result=await approveErpAccountingMapping(tx,reference,input,context.actorId);
  if(!result.replayed)await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_ACCOUNTING_MAPPING_APPROVED',entityType:'ERP_BUSINESS_PROJECTION',entityId:result.mapping.projectionId,afterData:{projectionReference:reference,mappingReference:result.mapping.mappingReference,reviewHash:result.mapping.reviewHash,requestHash:result.mapping.requestHash,approvalReference:result.mapping.approvalReference},requestId:context.requestId,correlationId:context.correlationId});
  return {mappingReference:result.mapping.mappingReference,revision:result.mapping.revision,requestHash:result.mapping.requestHash,replayed:result.replayed};
 });}
 async reconcile(reference:string,input:{resultKey:string;providerReference:string;requestHash:string;currency:string;occurredAt:string;groups:{groupReference:string;amount:string}[]},context:{actorId:string;requestId:string;correlationId:string}){
  const token=/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$/,amount=/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/;
  if(!/^ERP-PROJECTION-[a-f0-9]{40}$/.test(reference)||!token.test(input.resultKey)||!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(input.providerReference)||!/^[a-f0-9]{64}$/.test(input.requestHash)||!/^[A-Z]{3}$/.test(input.currency)||!Number.isFinite(new Date(input.occurredAt).getTime())||!Array.isArray(input.groups)||input.groups.length>1000||input.groups.some(group=>!/^(COMPENSATION|PAYMENT)-GROUP-[a-f0-9]{40}$/.test(group.groupReference)||!amount.test(group.amount))||new Set(input.groups.map(group=>group.groupReference)).size!==input.groups.length)throw new UnprocessableEntityException({code:'ERP_ACCOUNTING_RESULT_INVALID'});
  return this.run(async tx=>{
   await tx.$queryRaw`SELECT projection_id FROM commerce.erp_business_projection WHERE projection_reference=${reference} FOR UPDATE`;
   const projection=await tx.erpBusinessProjection.findUnique({where:{projectionReference:reference},include:{dispatch:true,outboxEvent:true,externalReference:true,accountingMappings:{orderBy:{revision:'desc'},take:1}}});
   if(!projection||projection.stream!=='COMPENSATION')throw new ConflictException({code:'ERP_MAPPING_COMPENSATION_REQUIRED'});
   const mapping=projection.accountingMappings[0];if(!mapping)throw new ConflictException({code:'ERP_ACCOUNT_MAPPING_REQUIRED'});
   const request=verifyErpAccountingMapping(projection,mapping) as any;
   if(!projection.dispatch||projection.dispatch.requestHash!==mapping.requestHash||projection.dispatch.providerConnectionVersionId!==mapping.providerConnectionVersionId||input.requestHash!==mapping.requestHash)throw new ConflictException({code:'ERP_ACCOUNTING_RESULT_REQUEST_MISMATCH'});
   if(projection.outboxEvent.processStatus!=='PROCESSED'||!projection.externalReference||projection.externalReference.providerReference!==input.providerReference)throw new ConflictException({code:'ERP_ACKNOWLEDGED_REFERENCE_REQUIRED'});
   const groups=input.groups.map(group=>({groupReference:group.groupReference,amount:new Prisma.Decimal(group.amount).toFixed(4)})).sort((a,b)=>a.groupReference.localeCompare(b.groupReference));
   const snapshot={format:'UCELL_ERP_ACCOUNTING_RESULT_V1',currency:input.currency,providerReference:input.providerReference,occurredAt:new Date(input.occurredAt).toISOString(),requestPayloadHash:mapping.requestHash,mappingReference:mapping.mappingReference,sourcePayloadHash:projection.payloadHash,groups},resultHash=replayHash(snapshot);
   const previous=await tx.erpProjectionReconciliation.findUnique({where:{projectionId_resultKey:{projectionId:projection.projectionId,resultKey:input.resultKey}}});
   if(previous){if(previous.resultHash!==resultHash)throw new ConflictException({code:'ERP_PROJECTION_RESULT_CONFLICT'});return {outcome:previous.outcome,resultHash,replayed:true};}
   const expected=request.aggregates.filter((group:any)=>group.treatment==='MAP');
   const mismatch=input.currency!==request.currency||groups.some(group=>{const item=expected.find((row:any)=>row.groupReference===group.groupReference);return !item||new Prisma.Decimal(group.amount).gt(item.amount);});
   const matched=!mismatch&&groups.length===expected.length&&groups.every(group=>new Prisma.Decimal(group.amount).eq(expected.find((row:any)=>row.groupReference===group.groupReference).amount));
   const outcome=mismatch?'MISMATCH':matched?'MATCHED':'PARTIAL',reasonCode=matched?'ERP_PROJECTION_EXACT_MATCH':mismatch?'ERP_ACCOUNTING_GROUP_MISMATCH':'ERP_PROJECTION_RESULT_INCOMPLETE';
   await tx.erpProjectionReconciliation.create({data:{projectionId:projection.projectionId,resultKey:input.resultKey,resultHash,outcome,reasonCode,providerReference:input.providerReference,resultSnapshot:snapshot,occurredAt:new Date(input.occurredAt),reportedByActor:context.actorId}});
   if(!matched){const source={sourceType:'ERP_BUSINESS_PROJECTION',sourceId:reference,exceptionCode:'ERP_PROJECTION_RESULT_MISMATCH'};await tx.operationalException.upsert({where:{sourceType_sourceId_exceptionCode:source},update:{status:'OPEN',evidenceHash:resultHash,resolvedAt:null,resolvedByActor:null,resolutionNote:null},create:{...source,severity:'HIGH',summary:'ERP 聚合金額尚未與核准映射版本一致。',evidenceHash:resultHash,traceId:context.correlationId}});}
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_ACCOUNTING_PROJECTION_RECONCILED',entityType:'ERP_BUSINESS_PROJECTION',entityId:projection.projectionId,afterData:{projectionReference:reference,mappingReference:mapping.mappingReference,outcome,resultHash},requestId:context.requestId,correlationId:context.correlationId});
   return {outcome,resultHash,replayed:false};
  });
 }
 history(reference:string,before?:number){
  if(!/^ERP-PROJECTION-[a-f0-9]{40}$/.test(reference)||before!==undefined&&(!Number.isInteger(before)||before<1))throw new UnprocessableEntityException({code:'ERP_MAPPING_QUERY_INVALID'});
  return this.run(async tx=>{const projection=await tx.erpBusinessProjection.findUnique({where:{projectionReference:reference}});if(!projection||projection.stream!=='COMPENSATION')throw new ConflictException({code:'ERP_MAPPING_COMPENSATION_REQUIRED'});
   const rows=await tx.erpAccountingMapping.findMany({where:{projectionId:projection.projectionId,...(before?{revision:{lt:before}}:{})},orderBy:{revision:'desc'},take:51});
   return {items:rows.slice(0,50).map(row=>({mappingReference:row.mappingReference,revision:row.revision,previousMappingReference:row.previousMappingReference,requestHash:row.requestHash,reviewHash:row.reviewHash,request:verifyErpAccountingMapping(projection,row),approvedAt:row.approvedAt.toISOString()})),nextBefore:rows.length>50?rows[49].revision:null};
  },true);
 }
}
