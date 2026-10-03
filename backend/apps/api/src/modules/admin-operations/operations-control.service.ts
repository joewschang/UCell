import {Injectable,UnprocessableEntityException} from '@nestjs/common';
import {erpBusinessReference,replayHash} from '@ucell/database';
import {ErpBusinessProjectionService} from '../commerce/erp-business-projection.service';
import {ErpReconciliationBridgeService} from '../commerce/erp-reconciliation-bridge.service';

/** Bounded per-stream windows. Cursor admission and current evidence stay distinct. */
@Injectable()
export class OperationsControlService{
 constructor(private readonly business:ErpBusinessProjectionService,private readonly fulfillment:ErpReconciliationBridgeService){}
 async erpHealth(input:{stream:string;take?:number;cursor?:string;asOf?:string;thresholdHours?:number}){
  if(!['SALES','RETURN','COMPENSATION','FULFILLMENT'].includes(input.stream)||input.thresholdHours!==undefined&&(!Number.isInteger(input.thresholdHours)||input.thresholdHours<1||input.thresholdHours>8760))throw new UnprocessableEntityException({code:'OPERATIONS_HEALTH_QUERY_INVALID'});
  const page=input.stream==='FULFILLMENT'?await this.fulfillment.list({take:input.take,cursor:input.cursor,asOf:input.asOf}):await this.business.list({stream:input.stream,take:input.take,cursor:input.cursor,asOf:input.asOf});
  const now=new Date(page.dataThrough),items=page.items.map((raw:any)=>{
   const physical=input.stream==='FULFILLMENT',reference=physical?erpBusinessReference('ERP-HANDOFF',`${raw.orderNo}:${raw.fulfillmentKey}`):raw.projectionReference,state=physical?raw.bridgeStatus:raw.status;
   const requestedAt=physical?raw.timestamps.queuedAt:raw.requestedAt,acknowledgedAt=physical?raw.timestamps.acknowledgedAt:raw.acknowledgedAt,reconciledAt=physical?raw.timestamps.reconciledAt:raw.reconciledAt;
   const payloadHash=physical?raw.evidence.payloadHash:raw.payloadHash,requestHash=physical?raw.evidence.payloadHash:raw.mapping?.requestHash??raw.payloadHash;
   const exceptionReferences=physical?(raw.evidence.exceptionReference&&raw.evidence.exceptionStatus!=='RESOLVED'?[raw.evidence.exceptionReference]:[]):(raw.exceptions??[]).map((row:any)=>row.reference);
   const queuedHours=Math.max(0,(now.getTime()-new Date(requestedAt).getTime())/3600000),since=state==='ACKNOWLEDGED'&&acknowledgedAt?acknowledgedAt:requestedAt,elapsedHours=Math.max(0,(now.getTime()-new Date(since).getTime())/3600000);
   const code=state==='FAILED'?'ERP_TRANSPORT_FAILED':state==='MISMATCH'?'ERP_RESULT_MISMATCH':exceptionReferences.length?'ERP_OPEN_EXCEPTION':input.thresholdHours!==undefined&&elapsedHours>=input.thresholdHours&&['QUEUED','SENT','ACKNOWLEDGED'].includes(state)?state==='ACKNOWLEDGED'?'ERP_RECONCILIATION_OVERDUE':'ERP_HANDOFF_OVERDUE':null;
   const severity=code==='ERP_TRANSPORT_FAILED'?'CRITICAL':'HIGH';
   const link=physical?`/erp-reconciliation?orderNo=${encodeURIComponent(raw.orderNo)}`:`/erp-reconciliation?stream=${input.stream}&projection=${encodeURIComponent(reference)}`;
   const candidate=code?{code,severity,sourceType:physical?'ERP_HANDOFF':'ERP_BUSINESS_PROJECTION',reference,evidenceHash:replayHash({code,reference,state,payloadHash,requestHash,reconciledAt,exceptionReferences,thresholdHours:input.thresholdHours??null}),link}:null;
   return {reference,stream:input.stream,state,orderNo:physical?raw.orderNo:raw.expected.orderNo??null,fulfillmentKey:physical?raw.fulfillmentKey:null,payloadHash,requestHash,providerReference:physical?raw.erp.providerReference:raw.providerReference,requestedAt,acknowledgedAt,reconciledAt,elapsedHours:Math.floor(elapsedHours),queuedHours:Math.floor(queuedHours),thresholdHours:input.thresholdHours??null,exceptionReferences,blockedReason:physical?(state==='BLOCKED_EXTERNAL'?'EZTOOL_LIVE_TRANSPORT_UNAVAILABLE':null):raw.blockedReason,link,candidate};
  });
  const counts=items.reduce<Record<string,number>>((result,row)=>(result[row.state]=(result[row.state]??0)+1,result),{}),successful=items.filter(row=>row.state==='RECONCILED'&&row.reconciledAt).map(row=>row.reconciledAt!).sort();
  return {items,counts,observed:items.length,candidateCount:items.filter(row=>row.candidate).length,latestSuccessfulReconciliation:successful.at(-1)??null,nextCursor:page.nextCursor,asOf:page.asOf,dataThrough:page.dataThrough,thresholdHours:input.thresholdHours??null,coverage:'CURRENT_PAGE_ONLY',liveTransportStatus:page.liveTransportStatus};
 }
}
