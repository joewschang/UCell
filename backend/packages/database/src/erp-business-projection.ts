import {Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {replayHash} from './historical-replay';

export type ErpProjectionStream='SALES'|'RETURN'|'COMPENSATION';
export type ErpProjectionContext={actorId:string;correlationId:string;approvalReference?:string};
export const erpBusinessReference=(kind:string,id:string)=>`${kind}-${replayHash({kind,id}).slice(0,40)}`;
export const erpProjectionReference=(stream:ErpProjectionStream,sourceIdentity:string)=>erpBusinessReference('ERP-PROJECTION',`${stream}:${sourceIdentity}:1`);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function fail(code:string):never{throw new Error(code);}

/** Internal writers only. Callers own source validation and the transaction. */
export async function sealErpBusinessProjection(tx:Prisma.TransactionClient,input:{stream:ErpProjectionStream;sourceIdentity:string;body:Record<string,unknown>;drillback:Record<string,unknown>;context:ErpProjectionContext}){
 const projectionReference=erpProjectionReference(input.stream,input.sourceIdentity);
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${projectionReference},0))`;
 const existing=await tx.erpBusinessProjection.findUnique({where:{projectionReference}});
 if(existing){verifyErpBusinessProjection(existing);return {projection:existing,replayed:true};}
 if(input.stream==='COMPENSATION'&&!input.context.approvalReference?.trim())fail('ERP_COMPENSATION_PROJECTION_APPROVAL_REQUIRED');
 const drillbackSnapshot=json(input.drillback),drillbackHash=replayHash(drillbackSnapshot),formatVersion='UCELL_ERP_BUSINESS_PROJECTION_V1';
 const payloadSnapshot=json({...input.body,schemaVersion:1,format:formatVersion,projectionReference,stream:input.stream,revision:1,drillbackHash});
 const payloadHash=replayHash(payloadSnapshot),projectionId=randomUUID();
 const outbox=await tx.outboxEvent.create({data:{eventType:'ERP_BUSINESS_PROJECTION_REQUESTED',aggregateType:'ERP_BUSINESS_PROJECTION',aggregateId:projectionId,payload:{projectionReference,payloadHash,stream:input.stream},correlationId:input.context.correlationId}});
 const projection=await tx.erpBusinessProjection.create({data:{projectionId,projectionReference,stream:input.stream,sourceIdentity:input.sourceIdentity,revision:1,formatVersion,payloadSnapshot,payloadHash,drillbackSnapshot,drillbackHash,approvalReference:input.context.approvalReference?.trim()??null,requestedByActor:input.context.actorId,outboxEventId:outbox.outboxEventId}});
 return {projection,replayed:false};
}

export function verifyErpBusinessProjection(row:{stream:string;projectionReference:string;formatVersion:string;revision:number;payloadSnapshot:unknown;payloadHash:string;drillbackSnapshot:unknown;drillbackHash:string}){
 const payload=row.payloadSnapshot as any;
 if(row.formatVersion!=='UCELL_ERP_BUSINESS_PROJECTION_V1'||payload?.format!==row.formatVersion||payload.schemaVersion!==1||payload.projectionReference!==row.projectionReference||payload.stream!==row.stream||payload.revision!==row.revision||payload.drillbackHash!==row.drillbackHash||replayHash(payload)!==row.payloadHash||replayHash(row.drillbackSnapshot)!==row.drillbackHash)fail('ERP_PROJECTION_INTEGRITY_INVALID');
 return payload;
}

export async function requestErpSalesProjection(tx:Prisma.TransactionClient,orderNo:string,context:ErpProjectionContext){
 if(!/^[0-9]{1,19}$/.test(orderNo)||BigInt(orderNo)>9223372036854775807n)fail('ERP_ORDER_REFERENCE_INVALID');
 const found=await tx.order.findUnique({where:{orderNo:BigInt(orderNo)}});if(!found)fail('ERP_ORDER_NOT_FOUND');
 await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${found.orderId}::uuid FOR UPDATE`;
 const existing=await tx.erpBusinessProjection.findUnique({where:{projectionReference:erpProjectionReference('SALES',found.orderId)}});
 if(existing){verifyErpBusinessProjection(existing);return {projection:existing,replayed:true};}
 const order=await tx.order.findUniqueOrThrow({where:{orderId:found.orderId},include:{lines:{orderBy:{orderLineId:'asc'}}}});
 if(!order.paidAt||!['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(order.status)||!order.lines.length)fail('ERP_SALES_APPROVED_SOURCE_REQUIRED');
 if(!order.grossAmount.sub(order.discountAmount).eq(order.netAmount)||order.lines.some(line=>line.quantity.lte(0)||line.lineAmount.lt(0)))fail('ERP_SALES_SOURCE_AMOUNT_INVALID');
 const lines=order.lines.map(line=>({lineReference:erpBusinessReference('ORDER-LINE',line.orderLineId),sku:line.skuSnapshot,quantity:line.quantity.toFixed(4),unitPrice:line.unitPrice.toFixed(2),amount:line.lineAmount.toFixed(2)}));
 const body={orderNo:order.orderNo.toString(),currency:order.currency,paidAt:order.paidAt.toISOString(),grossAmount:order.grossAmount.toFixed(2),discountAmount:order.discountAmount.toFixed(2),netAmount:order.netAmount.toFixed(2),lines};
 return sealErpBusinessProjection(tx,{stream:'SALES',sourceIdentity:order.orderId,body,drillback:{orderId:order.orderId,ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:order.parameterSnapshotHash,lines:order.lines.map((line,index)=>({orderLineId:line.orderLineId,...lines[index]})),grossAmount:body.grossAmount,discountAmount:body.discountAmount,netAmount:body.netAmount},context});
}

export async function requestErpReturnProjection(tx:Prisma.TransactionClient,returnCaseId:string,context:ErpProjectionContext){
 const found=await tx.returnCase.findUnique({where:{returnCaseId}});if(!found)fail('ERP_RETURN_NOT_FOUND');
 await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${found.orderId}::uuid FOR UPDATE`;
 await tx.$queryRaw`SELECT return_case_id FROM commerce.return_case WHERE return_case_id=${returnCaseId}::uuid FOR UPDATE`;
 const existing=await tx.erpBusinessProjection.findUnique({where:{projectionReference:erpProjectionReference('RETURN',returnCaseId)}});
 if(existing){verifyErpBusinessProjection(existing);return {projection:existing,replayed:true};}
 const ret=await tx.returnCase.findUniqueOrThrow({where:{returnCaseId},include:{order:{include:{lines:true}},lines:{include:{serialReceipts:{include:{shipmentBinding:{include:{allocation:{include:{serializedUnit:true}}}}}}},orderBy:{returnLineId:'asc'}}}});
 if(ret.status!=='POSTED'||!ret.lines.length)fail('ERP_RETURN_POSTED_SOURCE_REQUIRED');
 const sourceLines=new Map(ret.order.lines.map(row=>[row.orderLineId,row]));
 const lines=ret.lines.map(line=>{
  const source=sourceLines.get(line.orderLineId);if(!source||line.quantity.lte(0)||line.quantity.gt(source.quantity)||line.returnAmount.lt(0))fail('ERP_RETURN_SOURCE_INVALID');
  return {lineReference:erpBusinessReference('RETURN-LINE',line.returnLineId),originalLineReference:erpBusinessReference('ORDER-LINE',line.orderLineId),sku:source.skuSnapshot,quantity:line.quantity.toFixed(4),amount:line.returnAmount.toFixed(2),receivedSerialNos:line.serialReceipts.map(row=>row.shipmentBinding.allocation.serializedUnit.serialNo).sort()};
 });
 const body={orderNo:ret.order.orderNo.toString(),returnReference:erpBusinessReference('RETURN',ret.returnCaseId),currency:ret.order.currency,acceptedAt:(ret.postedAt??ret.occurredAt).toISOString(),amount:ret.lines.reduce((sum,row)=>sum.add(row.returnAmount),new Prisma.Decimal(0)).toFixed(2),lines};
 return sealErpBusinessProjection(tx,{stream:'RETURN',sourceIdentity:returnCaseId,body,drillback:{returnCaseId,orderId:ret.orderId,lines:ret.lines.map((row,index)=>({returnLineId:row.returnLineId,orderLineId:row.orderLineId,...lines[index],receiptIds:row.serialReceipts.map(receipt=>receipt.returnSerialReceiptId).sort()})),amount:body.amount},context});
}
