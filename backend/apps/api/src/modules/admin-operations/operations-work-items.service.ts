import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {ErpBusinessProjectionService} from '../commerce/erp-business-projection.service';
import {ErpReconciliationBridgeService} from '../commerce/erp-reconciliation-bridge.service';
import {OperationsControlService} from './operations-control.service';
import {requireOperationalExceptionResolution} from './operational-exception-resolution';
import {FINANCIAL_WORK_SOURCES,FINANCIAL_CANDIDATE_CODES,financialWorkReference,OperationsFinancialHealthService} from './operations-financial-health.service';
type Kind='TASK'|'EXCEPTION';
type Context={actorId:string;requestId:string;correlationId:string};
const sourceTypes=['ERP_BUSINESS_PROJECTION','ERP_HANDOFF','ERP_RECONCILIATION',...Object.keys(FINANCIAL_WORK_SOURCES)];
const roles=['FINANCE','COMPLIANCE_AUDIT','SUPER_ADMIN'];
const proof=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/.test(value);
const codes=['ERP_TRANSPORT_FAILED','ERP_RESULT_MISMATCH','ERP_OPEN_EXCEPTION','ERP_RECONCILIATION_OVERDUE','ERP_HANDOFF_OVERDUE',...FINANCIAL_CANDIDATE_CODES];
const rowRef=(kind:Kind,id:string)=>erpBusinessReference('OPS-'+kind,id);
@Injectable()
export class OperationsWorkItemsService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService,private readonly idempotency:IdempotencyService){}
 private readers(tx:Prisma.TransactionClient){const db={$transaction:(work:any)=>work(tx)} as any;return {business:new ErpBusinessProjectionService(db,this.audit),physical:new ErpReconciliationBridgeService(db)};}
 private async command<T>(key:string,body:unknown,context:Context,work:(tx:Prisma.TransactionClient)=>Promise<T>){
  if(!context.actorId||!/^[a-f0-9-]{36}$/i.test(key))throw new UnprocessableEntityException({code:'OPERATIONS_COMMAND_INVALID'});
  for(let n=0;;n++)try{return await this.idempotency.execute('admin:operations-control:'+context.actorId,key,body,work);}catch(error){if(n<3&&error instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(error.code))continue;throw error;}
 }
 private async resolve(tx:Prisma.TransactionClient,kind:Kind,reference:string,lock=false){
  if(!new RegExp(`^OPS-${kind}-[a-f0-9]{40}$`).test(reference))throw new UnprocessableEntityException({code:'OPERATIONS_REFERENCE_INVALID'});
  const table=kind==='TASK'?'operational_task':'operational_exception',column=kind==='TASK'?'operational_task_id':'operational_exception_id';
  const rows=await tx.$queryRaw<{id:string;createdAt:Date}[]>`SELECT ${Prisma.raw(column)} AS id,created_at AS "createdAt" FROM integration.${Prisma.raw(table)} WHERE source_type IN (${Prisma.join(sourceTypes)}) AND ${'OPS-'+kind+'-'} || substr(encode(sha256(convert_to('{"id":"' || ${Prisma.raw(column)}::text || '","kind":"' || ${'OPS-'+kind} || '"}','UTF8')),'hex'),1,40)=${reference} LIMIT 2 ${Prisma.raw(lock?'FOR UPDATE':'')}`;
  if(rows.length!==1)throw new ConflictException({code:'OPERATIONS_ITEM_NOT_FOUND'});return rows[0];
 }
 private async source(tx:Prisma.TransactionClient,type:string,id:string){
  const financial=financialWorkReference(type,id);
  if(financial){
   try{const resolved=await new OperationsFinancialHealthService({} as any).resolve(tx,financial.scope,financial.reference),reference=erpBusinessReference(financial.scope,resolved.id);return {reference,link:`/operations-control?scope=${financial.scope}&reference=${reference}`,orderNo:null,fulfillmentKey:null};}
   catch(error){if(!(error instanceof ConflictException))throw error;}
  }
  if(type==='ERP_BUSINESS_PROJECTION'&&/^ERP-PROJECTION-[a-f0-9]{40}$/.test(id)){
   const projection=await tx.erpBusinessProjection.findUnique({where:{projectionReference:id},select:{stream:true}});if(projection)return {reference:id,link:`/erp-reconciliation?stream=${projection.stream}&projection=${id}`,orderNo:null,fulfillmentKey:null};
  }
  if(['ERP_HANDOFF','ERP_RECONCILIATION'].includes(type)){
   const base=type==='ERP_RECONCILIATION'?id.replace(/:[a-f0-9]{64}$/,''):id,index=base.indexOf(':'),orderNo=base.slice(0,index),key=base.slice(index+1);
   if(index>0&&/^[0-9]{1,19}$/.test(orderNo)&&BigInt(orderNo)<=9223372036854775807n&&key.length<=200){const row=await tx.fulfillment.findFirst({where:{fulfillmentKey:key,order:{orderNo:BigInt(orderNo)}},select:{fulfillmentId:true}});if(row)return {reference:erpBusinessReference('ERP-HANDOFF',base),link:`/erp-reconciliation?orderNo=${orderNo}`,orderNo,fulfillmentKey:key};}
  }
  return {reference:erpBusinessReference('OPS-SOURCE',`${type}:${id}`),link:null,orderNo:null,fulfillmentKey:null};
 }
 private async publicRow(tx:Prisma.TransactionClient,kind:Kind,row:any){
  const source=await this.source(tx,row.sourceType,row.sourceId),rawCode=kind==='TASK'?row.taskCode.split(':')[0]:row.exceptionCode;
  const allowed=[...codes,'ERP_PROJECTION_REQUIRES_RECONCILIATION','ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT','ERP_PROJECTION_RESULT_MISMATCH','FULFILLMENT_ERP_MISMATCH','ERP_HANDOFF_REQUIRES_RECONCILIATION','ERP_HANDOFF_PARTIAL'];
  return {reference:rowRef(kind,kind==='TASK'?row.operationalTaskId:row.operationalExceptionId),kind,source,code:allowed.includes(rawCode)?rawCode:'ERP_REQUIRES_INVESTIGATION',status:row.status,priority:kind==='TASK'?['NORMAL','HIGH','CRITICAL'].includes(row.priority)?row.priority:'NORMAL':['WARNING','HIGH','CRITICAL'].includes(row.severity)?row.severity:'WARNING',assigneeRole:roles.includes(row.assigneeRole)?row.assigneeRole:null,dueAt:row.dueAt?.toISOString()??null,createdAt:row.createdAt.toISOString(),acknowledgedAt:row.acknowledgedAt?.toISOString()??null,closedAt:(kind==='TASK'?row.completedAt:row.resolvedAt)?.toISOString()??null,evidenceHash:typeof row.evidenceHash==='string'&&/^[a-f0-9]{64}$/.test(row.evidenceHash)?row.evidenceHash:null};
 }
 async list(kind:Kind,input:{status?:string;take?:number;cursor?:string;asOf?:string}){
  const allowed=kind==='TASK'?['OPEN','ACKNOWLEDGED','COMPLETED']:['OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED'],take=input.take??25,asOf=input.asOf?new Date(input.asOf):new Date();
  if(!Number.isInteger(take)||take<1||take>100||!Number.isFinite(asOf.getTime())||input.status&&!allowed.includes(input.status))throw new UnprocessableEntityException({code:'OPERATIONS_QUEUE_QUERY_INVALID'});
  return this.db.$transaction(async tx=>{
   const cursor=input.cursor?await this.resolve(tx,kind,input.cursor):null,idField=kind==='TASK'?'operationalTaskId':'operationalExceptionId';
   const where={sourceType:{in:sourceTypes},createdAt:{lte:asOf},...(input.status?{status:input.status as any}:{}),...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,[idField]:{lt:cursor.id}}]}:{})};
   const rows=kind==='TASK'?await tx.operationalTask.findMany({where,orderBy:[{createdAt:'desc'},{operationalTaskId:'desc'}],take:take+1}):await tx.operationalException.findMany({where,orderBy:[{createdAt:'desc'},{operationalExceptionId:'desc'}],take:take+1});
   const items=await Promise.all(rows.slice(0,take).map(row=>this.publicRow(tx,kind,row)));
   return {items,nextCursor:rows.length>take?items.at(-1)!.reference:null,asOf:asOf.toISOString(),dataThrough:new Date().toISOString(),scope:'ERP_AND_FINANCIAL_WORK_ITEMS'};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
 async createTask(input:{stream:string;reference:string;code:string;evidenceHash:string;thresholdHours?:number;cursor?:string;asOf?:string;assigneeRole:string;dueAt?:string},key:string,context:Context){
  const dueAt=input.dueAt?new Date(input.dueAt):null;if(!codes.includes(input.code)||!roles.includes(input.assigneeRole)||!/^[a-f0-9]{64}$/.test(input.evidenceHash)||dueAt&&!Number.isFinite(dueAt.getTime()))throw new UnprocessableEntityException({code:'OPERATIONS_TASK_INPUT_INVALID'});
  return this.command(key,{action:'CREATE_TASK',...input},context,async tx=>{
   let candidate:{sourceType:string;sourceId:string;reference:string;severity:string;evidenceHash:string;code:string}|undefined;
   if(['PAYOUT','PAYABLE','RECOVERY'].includes(input.stream)){
    const page=await new OperationsFinancialHealthService({$transaction:(work:any)=>work(tx)} as any).list({scope:input.stream,reference:input.reference,asOf:input.asOf,take:1}),item=page.items[0],match=item?.candidates.find(row=>row.code===input.code);
    if(match)candidate={...match,sourceType:Object.entries(FINANCIAL_WORK_SOURCES).find(([,scope])=>scope===input.stream)![0],sourceId:input.reference};
   }else{
    const readers=this.readers(tx),page=await new OperationsControlService(readers.business,readers.physical).erpHealth({...input,take:200}),item=page.items.find(row=>row.reference===input.reference);
    if(item?.candidate)candidate={...item.candidate,sourceId:item.candidate.sourceType==='ERP_HANDOFF'?`${item.orderNo}:${item.fulfillmentKey}`:item.reference};
   }
   if(!candidate||candidate.code!==input.code||candidate.evidenceHash!==input.evidenceHash)throw new ConflictException({code:'OPERATIONS_CANDIDATE_STALE'});
   const {sourceType,sourceId}=candidate,taskCode=input.code+':'+input.evidenceHash;
   const existing=await tx.operationalTask.findUnique({where:{sourceType_sourceId_taskCode:{sourceType,sourceId,taskCode}}});if(existing)return {item:await this.publicRow(tx,'TASK',existing),created:false};
   const task=await tx.operationalTask.create({data:{sourceType,sourceId,taskCode,priority:candidate.severity,summary:'來源證據需要作業處理。',assigneeRole:input.assigneeRole,dueAt,evidenceHash:input.evidenceHash,traceId:context.correlationId}});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'OPERATIONS_CANDIDATE_TASK_CREATED',entityType:'OPERATIONAL_TASK',entityId:task.operationalTaskId,afterData:{reference:rowRef('TASK',task.operationalTaskId),sourceReference:candidate.reference,code:input.code,evidenceHash:input.evidenceHash,assigneeRole:input.assigneeRole,dueAt:dueAt?.toISOString()??null},requestId:context.requestId,correlationId:context.correlationId});
   return {item:await this.publicRow(tx,'TASK',task),created:true};
  });
 }
 async transition(kind:Kind,reference:string,input:{status:string;expectedStatus:string;noteReference:string},key:string,context:Context){
  const allowed=kind==='TASK'?['ACKNOWLEDGED','COMPLETED']:['ACKNOWLEDGED','INVESTIGATING','RESOLVED'];if(!allowed.includes(input.status)||!proof(input.noteReference))throw new UnprocessableEntityException({code:'OPERATIONS_TRANSITION_INVALID'});
  return this.command(key,{action:'TRANSITION',kind,reference,...input},context,async tx=>{
   const resolved=await this.resolve(tx,kind,reference,true),row=kind==='TASK'?await tx.operationalTask.findUniqueOrThrow({where:{operationalTaskId:resolved.id}}):await tx.operationalException.findUniqueOrThrow({where:{operationalExceptionId:resolved.id}});
   if(row.status!==input.expectedStatus||['COMPLETED','RESOLVED'].includes(row.status)||input.status==='ACKNOWLEDGED'&&row.status!=='OPEN'||input.status===row.status)throw new ConflictException({code:'OPERATIONS_TRANSITION_STALE'});
   if(kind==='EXCEPTION'&&input.status==='RESOLVED')await requireOperationalExceptionResolution(tx,row);
   const now=new Date(),updated=kind==='TASK'?await tx.operationalTask.update({where:{operationalTaskId:resolved.id},data:{status:input.status as any,...(input.status==='COMPLETED'?{completedAt:now,completedByActor:context.actorId,completionNote:input.noteReference}:{acknowledgedAt:now,acknowledgedByActor:context.actorId})}}):await tx.operationalException.update({where:{operationalExceptionId:resolved.id},data:{status:input.status as any,...(input.status==='RESOLVED'?{resolvedAt:now,resolvedByActor:context.actorId,resolutionNote:input.noteReference}:{acknowledgedAt:now,acknowledgedByActor:context.actorId})}});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'OPERATIONS_WORK_ITEM_TRANSITIONED',entityType:kind==='TASK'?'OPERATIONAL_TASK':'OPERATIONAL_EXCEPTION',entityId:resolved.id,afterData:{reference,from:row.status,to:input.status,noteReference:input.noteReference},requestId:context.requestId,correlationId:context.correlationId});
   return this.publicRow(tx,kind,updated);
  });
 }
 async assign(reference:string,input:{expectedStatus:string;assigneeRole:string;dueAt:string|null;noteReference:string},key:string,context:Context){
  const dueAt=input.dueAt?new Date(input.dueAt):null;if(!roles.includes(input.assigneeRole)||!proof(input.noteReference)||dueAt&&!Number.isFinite(dueAt.getTime()))throw new UnprocessableEntityException({code:'OPERATIONS_ASSIGNMENT_INVALID'});
  return this.command(key,{action:'ASSIGN',reference,...input},context,async tx=>{
   const resolved=await this.resolve(tx,'TASK',reference,true),row=await tx.operationalTask.findUniqueOrThrow({where:{operationalTaskId:resolved.id}});
   if(row.status!==input.expectedStatus||row.status==='COMPLETED')throw new ConflictException({code:'OPERATIONS_TRANSITION_STALE'});
   const updated=await tx.operationalTask.update({where:{operationalTaskId:resolved.id},data:{assigneeRole:input.assigneeRole,assigneeActor:null,dueAt}});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'OPERATIONS_TASK_ASSIGNMENT_CHANGED',entityType:'OPERATIONAL_TASK',entityId:resolved.id,afterData:{reference,assigneeRole:input.assigneeRole,dueAt:dueAt?.toISOString()??null,noteReference:input.noteReference},requestId:context.requestId,correlationId:context.correlationId});
   return this.publicRow(tx,'TASK',updated);
  });
 }
}
