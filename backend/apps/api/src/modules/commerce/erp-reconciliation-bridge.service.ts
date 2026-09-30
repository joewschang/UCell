import {BadRequestException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';

export const ERP_BRIDGE_LIFECYCLES=['READY','QUEUED','SENT','ACKNOWLEDGED','RECONCILED','MISMATCH','FAILED','BLOCKED_EXTERNAL'] as const;
type BridgeLifecycle=typeof ERP_BRIDGE_LIFECYCLES[number];
type Query={status?:string;orderNo?:string;fulfillmentKey?:string;take?:number;asOf?:string;cursor?:string};
type Cursor={requestedAt:string;orderNo:string;fulfillmentKey:string};

const safeReference=(kind:string,value:string)=>`${kind}-${createHash('sha256').update(`${kind}:${value}`).digest('hex').slice(0,20)}`;
const publicCodes=new Set(['ERP_SKU_QUANTITY_MISMATCH','ERP_SERIAL_MISMATCH','ERP_EXACT_PHYSICAL_MATCH','ERP_PHYSICAL_RESULT_INCOMPLETE','ERP_ACCEPTANCE_REJECTED','ERP_ACCEPTANCE_UNKNOWN','ERP_HANDOFF_PROCESSING_FAILED','ERP_HANDOFF_REQUIRES_RECONCILIATION','ERP_HANDOFF_PARTIAL','FULFILLMENT_ERP_MISMATCH']);
const safeCode=(value:string|null|undefined)=>value?publicCodes.has(value)?value:'ERP_BRIDGE_REQUIRES_ATTENTION':null;
const encode=(value:Cursor)=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
function decode(value:string):Cursor{
 try{
  const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8')) as Cursor;
  if(!parsed||typeof parsed.requestedAt!=='string'||!/^\d{1,19}$/.test(parsed.orderNo)||typeof parsed.fulfillmentKey!=='string'||parsed.fulfillmentKey.length>200||!Number.isFinite(new Date(parsed.requestedAt).getTime()))throw new Error();
  return parsed;
 }catch{throw new BadRequestException({code:'ERP_BRIDGE_CURSOR_INVALID'});}
}
function positiveInteger(value:number|undefined){
 const result=value??50;
 if(!Number.isInteger(result)||result<1||result>200)throw new BadRequestException({code:'ERP_BRIDGE_TAKE_INVALID'});
 return result;
}
function date(value:string|undefined){
 const result=value?new Date(value):new Date();
 if(!Number.isFinite(result.getTime()))throw new BadRequestException({code:'ERP_BRIDGE_AS_OF_INVALID'});
 return result;
}
function lineSummary(raw:unknown){
 const lines=Array.isArray((raw as any)?.lines)?(raw as any).lines:[];
 return lines.flatMap((line:any)=>typeof line?.sku==='string'&&typeof line?.quantity==='string'&&/^\d+(?:\.0+)?$/.test(line.quantity)?[{sku:line.sku,quantity:line.quantity,serialCount:Array.isArray(line.serialNos)?line.serialNos.length:0}]:[]);
}
function lifecycle(row:any):BridgeLifecycle{
 const latest=row.reconciliations[0],attempt=row.dispatch?.attempts?.[0];
 if(latest?.outcome==='MATCHED')return 'RECONCILED';
 if(latest?.outcome==='MISMATCH'||latest?.outcome==='PARTIAL')return 'MISMATCH';
 if(row.outboxEvent.processStatus==='DEAD'||attempt?.outcome==='REJECTED')return 'FAILED';
 if(attempt?.outcome==='ACCEPTED')return 'ACKNOWLEDGED';
 if(row.outboxEvent.processStatus==='PROCESSING')return 'SENT';
 if(row.providerCode==='ERP_PENDING'&&row.outboxEvent.processStatus==='PENDING'&&row.outboxEvent.attemptCount>0)return 'BLOCKED_EXTERNAL';
 return 'QUEUED';
}
function shipmentStatus(shipments:any[]){
 if(!shipments.length)return 'NOT_CREATED';
 const order=['READY','LABEL_CREATED','PICKED_UP','IN_TRANSIT','DELIVERED','DELIVERY_FAILED','RETURNING','RETURNED','CANCELLED'];
 return [...shipments].sort((a,b)=>order.indexOf(b.status)-order.indexOf(a.status))[0]?.status??'NOT_CREATED';
}

@Injectable()
export class ErpReconciliationBridgeService{
 constructor(private readonly db:PrismaService){}
 async list(query:Query){
  const take=positiveInteger(query.take),asOf=date(query.asOf),cursor=query.cursor?decode(query.cursor):undefined;
  if(query.orderNo&&!/^\d{1,19}$/.test(query.orderNo))throw new BadRequestException({code:'ERP_BRIDGE_ORDER_NO_INVALID'});
  if(query.fulfillmentKey&&(!query.orderNo||query.fulfillmentKey.length>200))throw new BadRequestException({code:'ERP_BRIDGE_FULFILLMENT_KEY_INVALID'});
  if(query.status&&!ERP_BRIDGE_LIFECYCLES.includes(query.status as BridgeLifecycle))throw new BadRequestException({code:'ERP_BRIDGE_STATUS_INVALID'});
  // asOf fixes handoff admission across pages; mutable domain statuses are read
  // from the current transaction snapshot, not reconstructed historical state.
  return this.db.$transaction(async tx=>{
  const dataThrough=new Date().toISOString();
  const rows=await tx.fulfillmentErpHandoff.findMany({
   where:{requestedAt:{lte:asOf},...(query.orderNo?{fulfillment:{order:{orderNo:BigInt(query.orderNo)},...(query.fulfillmentKey?{fulfillmentKey:query.fulfillmentKey}:{})}}:{}),...(cursor?{OR:[{requestedAt:{lt:new Date(cursor.requestedAt)}},{requestedAt:new Date(cursor.requestedAt),fulfillment:{order:{orderNo:{lt:BigInt(cursor.orderNo)}}}},{requestedAt:new Date(cursor.requestedAt),fulfillment:{order:{orderNo:BigInt(cursor.orderNo)},fulfillmentKey:{lt:cursor.fulfillmentKey}}}]}:{})},
   include:{outboxEvent:{select:{processStatus:true,attemptCount:true,createdAt:true,processedAt:true,lastError:true}},dispatch:{include:{attempts:{orderBy:{attemptNumber:'desc'},take:1},providerConnectionVersion:{include:{connection:{select:{provider:true,connectionKey:true}}}}}},reconciliations:{orderBy:[{occurredAt:'desc'},{recordedAt:'desc'}],take:1},fulfillment:{include:{order:{select:{orderNo:true,status:true}},shipments:{select:{status:true}}}}},
   orderBy:[{requestedAt:'desc'},{fulfillment:{order:{orderNo:'desc'}}},{fulfillment:{fulfillmentKey:'desc'}}],take:take+1,
  });
  const pageRows=rows.slice(0,take);
  // An exact later result does not resolve an earlier investigation. A lateral
  // lookup returns at most one open exception per handoff, with exact source
  // joins rather than ambiguous prefix matching on fulfillment business keys.
  const exceptions=pageRows.length?await tx.$queryRaw<Array<{handoffId:string;operationalExceptionId:string;exceptionCode:string;severity:string;status:string}>>`
   SELECT h.fulfillment_erp_handoff_id AS "handoffId", e.operational_exception_id AS "operationalExceptionId", e.exception_code AS "exceptionCode", e.severity,e.status::text
   FROM commerce.fulfillment_erp_handoff h JOIN commerce.fulfillment f ON f.fulfillment_id=h.fulfillment_id JOIN commerce."order" o ON o.order_id=f.order_id
   CROSS JOIN LATERAL (SELECT x.* FROM integration.operational_exception x WHERE x.status::text<>'RESOLVED' AND (
    (x.source_type='ERP_HANDOFF' AND x.source_id=o.order_no::text || ':' || f.fulfillment_key)
    OR (x.source_type='ERP_RECONCILIATION' AND EXISTS(SELECT 1 FROM commerce.fulfillment_erp_reconciliation r WHERE r.fulfillment_erp_handoff_id=h.fulfillment_erp_handoff_id AND x.source_id=o.order_no::text || ':' || f.fulfillment_key || ':' || r.result_hash::text))
   ) ORDER BY x.created_at DESC,x.operational_exception_id DESC LIMIT 1) e
   WHERE h.fulfillment_erp_handoff_id IN (${Prisma.join(pageRows.map(row=>Prisma.sql`${row.fulfillmentErpHandoffId}::uuid`))})`:[];
  const mapped=pageRows.map(row=>{
   const state=lifecycle(row),latest=row.reconciliations[0],attempt=row.dispatch?.attempts?.[0];
   const expected=lineSummary(row.payloadSnapshot),actual=lineSummary(latest?.resultSnapshot);
   const exception=exceptions.find(item=>item.handoffId===row.fulfillmentErpHandoffId);
   return {orderNo:row.fulfillment.order.orderNo.toString(),fulfillmentKey:row.fulfillment.fulfillmentKey,bridgeStatus:state,ucell:{orderStatus:row.fulfillment.order.status,fulfillmentStatus:row.fulfillment.status},erp:{provider:row.dispatch?.providerConnectionVersion.connection.provider??row.providerCode,connection:row.dispatch?.providerConnectionVersion.connection.connectionKey??null,formatVersion:row.formatVersion,outboxStatus:row.outboxEvent.processStatus,attemptCount:row.outboxEvent.attemptCount,latestAttemptOutcome:attempt?.outcome??null,providerReference:attempt?.providerReference??null,expected,actual,reconciliationOutcome:latest?.outcome??null,reasonCode:safeCode(latest?.reasonCode??row.outboxEvent.lastError)},shipment:{status:shipmentStatus(row.fulfillment.shipments),count:row.fulfillment.shipments.length},evidence:{payloadHash:row.payloadHash,resultHash:latest?.resultHash??null,exceptionReference:exception?safeReference('ERP-EXCEPTION',exception.operationalExceptionId):null,exceptionCode:safeCode(exception?.exceptionCode),exceptionSeverity:exception?.severity??null,exceptionStatus:exception?.status??null},timestamps:{queuedAt:row.requestedAt.toISOString(),sentAt:null,dispatchPreparedAt:row.dispatch?.createdAt.toISOString()??null,acknowledgedAt:attempt?.outcome==='ACCEPTED'?attempt.recordedAt.toISOString():null,reconciledAt:latest?.recordedAt.toISOString()??null,dataThrough}};
  }).filter(item=>!query.status||item.bridgeStatus===query.status);
  const visible=mapped.slice(0,take),boundary=rows[Math.min(rows.length,take)-1];
  return {asOf:asOf.toISOString(),dataThrough,items:visible,nextCursor:rows.length>take&&boundary?encode({requestedAt:boundary.requestedAt.toISOString(),orderNo:boundary.fulfillment.order.orderNo.toString(),fulfillmentKey:boundary.fulfillment.fulfillmentKey}):null,limit:take,authority:{ucell:'Order/Fulfillment facts in UCell',erp:'Stored handoff, dispatch and reconciliation evidence',shipment:'Shipment facts remain independent from ERP acceptance'},liveTransportStatus:'BLOCKED_EXTERNAL'};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
 }
}
