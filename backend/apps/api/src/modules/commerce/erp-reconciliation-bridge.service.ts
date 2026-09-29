import {BadRequestException,Injectable} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';

export const ERP_BRIDGE_LIFECYCLES=['READY','QUEUED','SENT','ACKNOWLEDGED','RECONCILED','MISMATCH','FAILED','BLOCKED_EXTERNAL'] as const;
type BridgeLifecycle=typeof ERP_BRIDGE_LIFECYCLES[number];
type Query={status?:string;orderNo?:string;take?:number;asOf?:string;cursor?:string};
type Cursor={requestedAt:string;orderNo:string;fulfillmentKey:string};

const safeReference=(kind:string,value:string)=>`${kind}-${createHash('sha256').update(`${kind}:${value}`).digest('hex').slice(0,20)}`;
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
  if(query.status&&!ERP_BRIDGE_LIFECYCLES.includes(query.status as BridgeLifecycle))throw new BadRequestException({code:'ERP_BRIDGE_STATUS_INVALID'});
  const rows=await this.db.fulfillmentErpHandoff.findMany({
   where:{requestedAt:{lte:asOf},...(query.orderNo?{fulfillment:{order:{orderNo:BigInt(query.orderNo)}}}:{}),...(cursor?{OR:[{requestedAt:{lt:new Date(cursor.requestedAt)}},{requestedAt:new Date(cursor.requestedAt),fulfillment:{order:{orderNo:{lt:BigInt(cursor.orderNo)}}}},{requestedAt:new Date(cursor.requestedAt),fulfillment:{order:{orderNo:BigInt(cursor.orderNo)},fulfillmentKey:{lt:cursor.fulfillmentKey}}}]}:{})},
   include:{outboxEvent:{select:{processStatus:true,attemptCount:true,createdAt:true,processedAt:true,lastError:true}},dispatch:{include:{attempts:{orderBy:{attemptNumber:'desc'},take:1},providerConnectionVersion:{include:{connection:{select:{provider:true,connectionKey:true}}}}}},reconciliations:{orderBy:[{occurredAt:'desc'},{recordedAt:'desc'}],take:1},fulfillment:{include:{order:{select:{orderNo:true,status:true}},shipments:{select:{status:true}}}}},
   orderBy:[{requestedAt:'desc'},{fulfillment:{order:{orderNo:'desc'}}},{fulfillment:{fulfillmentKey:'desc'}}],take:take+1,
  });
  const exceptionSources=rows.flatMap(row=>{
   const latest=row.reconciliations[0],orderNo=row.fulfillment.order.orderNo.toString(),key=row.fulfillment.fulfillmentKey;
   return [...(latest&&latest.outcome!=='MATCHED'?[{sourceType:'ERP_RECONCILIATION',sourceId:`${orderNo}:${key}:${latest.resultHash}`}]:[]),...((row.outboxEvent.processStatus==='DEAD'||row.dispatch?.attempts?.[0]?.outcome==='REJECTED')?[{sourceType:'ERP_HANDOFF',sourceId:`${orderNo}:${key}`}]:[])];
  });
  const exceptions=exceptionSources.length?await this.db.operationalException.findMany({where:{OR:exceptionSources},select:{operationalExceptionId:true,sourceType:true,sourceId:true,exceptionCode:true,severity:true,status:true}}):[];
  const mapped=rows.map(row=>{
   const state=lifecycle(row),latest=row.reconciliations[0],attempt=row.dispatch?.attempts?.[0];
   const expected=lineSummary(row.payloadSnapshot),actual=lineSummary(latest?.resultSnapshot);
   const reconciliationSource=latest&&latest.outcome!=='MATCHED'?`${row.fulfillment.order.orderNo}:${row.fulfillment.fulfillmentKey}:${latest.resultHash}`:null,handoffSource=attempt?.outcome==='REJECTED'||row.outboxEvent.processStatus==='DEAD'?`${row.fulfillment.order.orderNo}:${row.fulfillment.fulfillmentKey}`:null;
   const exception=exceptions.find(item=>(reconciliationSource&&item.sourceType==='ERP_RECONCILIATION'&&item.sourceId===reconciliationSource)||(handoffSource&&item.sourceType==='ERP_HANDOFF'&&item.sourceId===handoffSource));
   return {orderNo:row.fulfillment.order.orderNo.toString(),fulfillmentKey:row.fulfillment.fulfillmentKey,bridgeStatus:state,ucell:{orderStatus:row.fulfillment.order.status,fulfillmentStatus:row.fulfillment.status},erp:{provider:row.dispatch?.providerConnectionVersion.connection.provider??row.providerCode,connection:row.dispatch?.providerConnectionVersion.connection.connectionKey??null,formatVersion:row.formatVersion,outboxStatus:row.outboxEvent.processStatus,attemptCount:row.outboxEvent.attemptCount,latestAttemptOutcome:attempt?.outcome??null,providerReference:attempt?.providerReference??null,expected,actual,reconciliationOutcome:latest?.outcome??null,reasonCode:latest?.reasonCode??row.outboxEvent.lastError??null},shipment:{status:shipmentStatus(row.fulfillment.shipments),count:row.fulfillment.shipments.length},evidence:{payloadHash:row.payloadHash,resultHash:latest?.resultHash??null,exceptionReference:exception?safeReference('ERP-EXCEPTION',exception.operationalExceptionId):null,exceptionCode:exception?.exceptionCode??null,exceptionSeverity:exception?.severity??null,exceptionStatus:exception?.status??null},timestamps:{queuedAt:row.requestedAt.toISOString(),sentAt:row.dispatch?.createdAt.toISOString()??null,acknowledgedAt:attempt?.recordedAt.toISOString()??null,reconciledAt:latest?.recordedAt.toISOString()??null,dataThrough:asOf.toISOString()}};
  }).filter(item=>!query.status||item.bridgeStatus===query.status);
  const visible=mapped.slice(0,take),boundary=rows[Math.min(rows.length,take)-1];
  return {asOf:asOf.toISOString(),dataThrough:asOf.toISOString(),items:visible,nextCursor:rows.length>take&&boundary?encode({requestedAt:boundary.requestedAt.toISOString(),orderNo:boundary.fulfillment.order.orderNo.toString(),fulfillmentKey:boundary.fulfillment.fulfillmentKey}):null,limit:take,authority:{ucell:'Order/Fulfillment facts in UCell',erp:'Stored handoff, dispatch and reconciliation evidence',shipment:'Shipment facts remain independent from ERP acceptance'},liveTransportStatus:'BLOCKED_EXTERNAL'};
 }
}
