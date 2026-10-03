import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';

export type ErpPhysicalLine={sku:string;quantity:string;serialNos:string[]};
export type ErpPhysicalResult={resultKey:string;providerReference:string;occurredAt:Date;lines:ErpPhysicalLine[]};
function normalize(lines:ErpPhysicalLine[]){
 if(!Array.isArray(lines)||lines.length>1000)throw new UnprocessableEntityException({code:'ERP_RESULT_INVALID'});
 const bySku=new Map<string,{sku:string;quantity:number;serialNos:string[]}>();
 for(const line of lines){
  if(!line||typeof line.quantity!=='string'||!/^\d+(?:\.0+)?$/.test(line.quantity))throw new UnprocessableEntityException({code:'ERP_RESULT_INVALID'});
  const quantity=Number(line.quantity);
  if(typeof line.sku!=='string'||!line.sku.trim()||line.sku.length>128||!Number.isSafeInteger(quantity)||quantity<0||!Array.isArray(line.serialNos)||line.serialNos.length>10000||line.serialNos.some(s=>typeof s!=='string'||!/^[A-E][0-9]{7}$/.test(s)))throw new UnprocessableEntityException({code:'ERP_RESULT_INVALID'});
  const row=bySku.get(line.sku)??{sku:line.sku,quantity:0,serialNos:[]};row.quantity+=quantity;row.serialNos.push(...line.serialNos);
  if(!Number.isSafeInteger(row.quantity))throw new UnprocessableEntityException({code:'ERP_RESULT_INVALID'});
  bySku.set(line.sku,row);
 }
 return [...bySku.values()].sort((a,b)=>a.sku.localeCompare(b.sku)).map(row=>({sku:row.sku,quantity:String(row.quantity),serialNos:row.serialNos.sort()}));
}
export function reconcilePhysicalLines(expectedInput:ErpPhysicalLine[],actualInput:ErpPhysicalLine[]){
 const expected=normalize(expectedInput),actual=normalize(actualInput),expectedBySku=new Map(expected.map(row=>[row.sku,row])),seen=new Set<string>();
 for(const row of actual){
  const wanted=expectedBySku.get(row.sku);
  if(!wanted||Number(row.quantity)>Number(wanted.quantity)||Number(row.quantity)!==row.serialNos.length)return {outcome:'MISMATCH',reasonCode:'ERP_SKU_QUANTITY_MISMATCH',actual};
  for(const serial of row.serialNos){
   if(seen.has(serial)||!wanted.serialNos.includes(serial))return {outcome:'MISMATCH',reasonCode:'ERP_SERIAL_MISMATCH',actual};
   seen.add(serial);
  }
 }
 const matched=expected.every(row=>actual.some(a=>a.sku===row.sku&&a.quantity===row.quantity&&a.serialNos.length===row.serialNos.length));
 return {outcome:matched?'MATCHED':'PARTIAL',reasonCode:matched?'ERP_EXACT_PHYSICAL_MATCH':'ERP_PHYSICAL_RESULT_INCOMPLETE',actual};
}

@Injectable()
export class FulfillmentErpReconciliationService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 async record(fulfillmentId:string,input:ErpPhysicalResult,context:{actorId:string;requestId:string;correlationId:string}){
  if(typeof input.resultKey!=='string'||!input.resultKey.trim()||input.resultKey.length>200||typeof input.providerReference!=='string'||!input.providerReference.trim()||input.providerReference.length>200||!Number.isFinite(input.occurredAt.getTime()))throw new UnprocessableEntityException({code:'ERP_RESULT_INVALID'});
  const actual=normalize(input.lines);
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${fulfillmentId}::uuid FOR UPDATE`;
   const handoff=await tx.fulfillmentErpHandoff.findUnique({where:{fulfillmentId},include:{fulfillment:{include:{order:{select:{orderNo:true}}}}}});
   if(!handoff)throw new ConflictException({code:'ERP_HANDOFF_REQUIRED'});
   const request=handoff.payloadSnapshot as any;
   if(request?.format!=='UCELL_FULFILLMENT_ERP_V1'||!Array.isArray(request.lines)||!request.lines.length)throw new ConflictException({code:'ERP_REQUEST_SNAPSHOT_INVALID'});
   const result=reconcilePhysicalLines(request.lines,actual);
   const snapshot={schemaVersion:1,reportedVia:'CONTROLLED_ADMIN',requestPayloadHash:handoff.payloadHash,providerReference:input.providerReference,occurredAt:input.occurredAt.toISOString(),lines:result.actual};
   const resultHash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
   const existing=await tx.fulfillmentErpReconciliation.findUnique({where:{fulfillmentErpHandoffId_resultKey:{fulfillmentErpHandoffId:handoff.fulfillmentErpHandoffId,resultKey:input.resultKey}}});
   if(existing){if(existing.resultHash!==resultHash)throw new ConflictException({code:'ERP_RESULT_IDEMPOTENCY_CONFLICT'});return {outcome:existing.outcome,reasonCode:existing.reasonCode,resultHash:existing.resultHash,replayed:true};}
   await tx.fulfillmentErpReconciliation.create({data:{fulfillmentErpHandoffId:handoff.fulfillmentErpHandoffId,resultKey:input.resultKey,resultHash,outcome:result.outcome,reasonCode:result.reasonCode,resultSnapshot:snapshot,occurredAt:input.occurredAt,reportedByActor:context.actorId}});
   if(result.outcome!=='MATCHED'){
    const source={sourceType:'ERP_RECONCILIATION',sourceId:`${handoff.fulfillment.order.orderNo}:${handoff.fulfillment.fulfillmentKey}:${resultHash}`,exceptionCode:result.outcome==='PARTIAL'?'ERP_HANDOFF_PARTIAL':'FULFILLMENT_ERP_MISMATCH'};
    await tx.operationalException.upsert({where:{sourceType_sourceId_exceptionCode:source},update:{},create:{...source,severity:result.outcome==='PARTIAL'?'WARNING':'CRITICAL',evidenceHash:resultHash,traceId:context.correlationId,summary:result.outcome==='PARTIAL'?'ERP 實際出貨尚未符合全部配置。':'ERP 商品、數量或序號與交付快照不符。'}});
   }
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'FULFILLMENT_ERP_RECONCILED',entityType:'FULFILLMENT',entityId:fulfillmentId,afterData:{fulfillmentKey:handoff.fulfillment.fulfillmentKey,outcome:result.outcome,resultHash},requestId:context.requestId,correlationId:context.correlationId});
   // A matched provider report is not a Shipment. Shipment binding is a
   // separately validated authority; never mark Order/Fulfillment paid/shipped here.
   return {outcome:result.outcome,reasonCode:result.reasonCode,resultHash,replayed:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
 }
}
