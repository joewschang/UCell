import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,AccountingMappingConfiguration,previewErpAccountingMapping,approveErpAccountingMapping,verifyErpAccountingMapping} from '@ucell/database';
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
 history(reference:string,before?:number){
  if(!/^ERP-PROJECTION-[a-f0-9]{40}$/.test(reference)||before!==undefined&&(!Number.isInteger(before)||before<1))throw new UnprocessableEntityException({code:'ERP_MAPPING_QUERY_INVALID'});
  return this.run(async tx=>{const projection=await tx.erpBusinessProjection.findUnique({where:{projectionReference:reference}});if(!projection||projection.stream!=='COMPENSATION')throw new ConflictException({code:'ERP_MAPPING_COMPENSATION_REQUIRED'});
   const rows=await tx.erpAccountingMapping.findMany({where:{projectionId:projection.projectionId,...(before?{revision:{lt:before}}:{})},orderBy:{revision:'desc'},take:51});
   return {items:rows.slice(0,50).map(row=>({mappingReference:row.mappingReference,revision:row.revision,previousMappingReference:row.previousMappingReference,requestHash:row.requestHash,reviewHash:row.reviewHash,request:verifyErpAccountingMapping(projection,row),approvedAt:row.approvedAt.toISOString()})),nextBefore:rows.length>50?rows[49].revision:null};
  },true);
 }
}
