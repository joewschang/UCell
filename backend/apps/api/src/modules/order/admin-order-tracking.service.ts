import {Injectable,ConflictException} from '@nestjs/common';
import {Prisma,PrismaService,decideTrackingProjection} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {orderTab} from '../member/order-hub-state';
import {parseTrackingCsv,validateTrackingRow,trackingHash,rowPayload,TrackingRow} from './tracking-import-format';
type Context={actorId:string;role:string;requestId:string};
type Result={row:number;orderNo:string;trackingNo:string;from:string;to:string;result:'APPLY'|'SKIP'|'ERROR';reason:string};
@Injectable()
export class AdminOrderTrackingService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 async list(query:{tab?:string;search?:string;page?:number}){
  return this.db.$transaction(async tx=>{
   const orders=await tx.order.findMany({include:{lines:true,payments:{orderBy:{createdAt:'desc'}},fulfillments:{include:{shipments:true}}},orderBy:[{createdAt:'desc'},{orderId:'desc'}]});
   const reviews=await tx.$queryRaw<{order_id:string;rating:number;comment:string}[]>`SELECT order_id,rating,comment FROM commerce.member_order_review`;
   const counts:Record<string,number>={ALL:orders.length,PAYMENT:0,SHIPPING:0,RECEIVING:0,REVIEW:0,COMPLETED:0,EXCEPTION:0,OTHER:0};
   const mapped=orders.map(o=>{
    const review=reviews.filter(r=>r.order_id===o.orderId),base=orderTab(o,review.length>0);
    const tab=o.fulfillments.some(f=>f.status!=='CANCELLED'&&f.shipments.some(s=>['DELIVERY_FAILED','RETURNING'].includes(s.status)))?'EXCEPTION':base;
    counts[tab]++;return {orderId:o.orderId,orderNo:String(o.orderNo),tab,total:String(o.netAmount),createdAt:o.createdAt.toISOString(),status:o.status,paymentStatus:o.payments.find(p=>['REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED'].includes(p.status))?.status??(o.paidAt?'PAID':o.payments[0]?.status??'PENDING'),items:o.lines.map(l=>({name:l.productNameSnapshot,sku:l.skuSnapshot,quantity:String(l.quantity)})),fulfillments:o.fulfillments.map(f=>({key:f.fulfillmentKey,status:f.status,shipments:f.shipments.map(s=>({carrier:s.carrier,trackingNo:s.trackingNo,status:s.status}))})),reviews:review.map(r=>({rating:r.rating,comment:r.comment}))};
   });
   const search=(query.search??'').toLowerCase().trim();const rows=mapped.filter(o=>(!query.tab||query.tab==='ALL'||o.tab===query.tab)&&(!search||[o.orderNo,...o.items.map(i=>i.name+' '+i.sku),...o.fulfillments.flatMap(f=>f.shipments.map(s=>s.trackingNo))].join(' ').toLowerCase().includes(search)));
   const pages=Math.max(1,Math.ceil(rows.length/20)),page=Math.min(query.page??1,pages);
   return {counts,orders:rows.slice((page-1)*20,page*20),page,pages,total:rows.length,asOf:new Date().toISOString()};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async timeline(orderNo:string){
  const shipments=await this.db.shipment.findMany({where:{fulfillment:{order:{orderNo:BigInt(orderNo)}}},include:{fulfillment:{select:{fulfillmentKey:true}},trackingEvidence:{orderBy:{eventTime:'desc'},take:100}}});
  return shipments.map(s=>({key:s.fulfillment.fulfillmentKey,carrier:s.carrier,trackingNo:s.trackingNo,status:s.status,events:s.trackingEvidence.map(e=>({status:e.normalizedStatus??e.rawStatusCode,at:e.eventTime.toISOString(),source:e.providerEventIdentity.startsWith('file-v1:')?'檔案匯入':'物流同步'}))}));
 }
 async history(){return (await this.db.auditEvent.findMany({where:{action:'ORDER_TRACKING_FILE_IMPORTED'},orderBy:{createdAt:'desc'},take:20,select:{createdAt:true,afterData:true,actorRoleSnapshot:true}})).map(a=>({at:a.createdAt.toISOString(),role:a.actorRoleSnapshot,...(a.afterData as object)}));}
 private async plan(tx:any,csv:string,lock=false){
  let rows:TrackingRow[];try{rows=parseTrackingCsv(csv);}catch(e){return {fileHash:trackingHash(csv),previewHash:'',rows:[] as Result[],errors:[(e as Error).message],changes:[] as any[],skips:0};}
  const ids=rows.filter(r=>!validateTrackingRow(r)).map(r=>BigInt(r.order_no));
  let shipments=await tx.shipment.findMany({where:{fulfillment:{order:{orderNo:{in:ids}}}},include:{fulfillment:{include:{order:{select:{orderNo:true,status:true}}}}}});
  if(lock){
   // Match the lock order used by the shipment worker: fulfillment, then shipment.
   for(const id of [...new Set<string>(shipments.map((s:any)=>s.fulfillmentId))].sort())await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${id}::uuid FOR UPDATE`;
   for(const s of [...shipments].sort((a:any,b:any)=>a.shipmentId.localeCompare(b.shipmentId)))await tx.$queryRaw`SELECT shipment_id FROM commerce.shipment WHERE shipment_id=${s.shipmentId}::uuid FOR UPDATE`;
   shipments=await tx.shipment.findMany({where:{shipmentId:{in:shipments.map((s:any)=>s.shipmentId)}},include:{fulfillment:{include:{order:{select:{orderNo:true,status:true}}}}}});
  }
  const evidenceIds=rows.map(r=>'file-v1:'+trackingHash([r.source_system,r.event_id]));
  const prior=await tx.shipmentTrackingEventEvidence.findMany({where:{providerEventIdentity:{in:evidenceIds}}});
  const latest=await tx.shipmentStateTransition.findMany({where:{shipmentId:{in:shipments.map((s:any)=>s.shipmentId)}},orderBy:{occurredAt:'desc'},distinct:['shipmentId']});
  const state=new Map<string,{status:string;time:string}>();
  for(const s of shipments)state.set(s.shipmentId,{status:s.status,time:(latest.find((e:any)=>e.shipmentId===s.shipmentId)?.occurredAt??s.createdAt).toISOString()});
  const baseline=[...state.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const results:Result[]=[],changes:any[]=[],seen=new Map<string,string>();
  for(const r of [...rows].sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||a.row-b.row)){
   const result:Result={row:r.row,orderNo:r.order_no,trackingNo:r.tracking_no,from:'—',to:r.status,result:'ERROR',reason:validateTrackingRow(r)??''};results.push(result);if(result.reason)continue;
   const matches=shipments.filter((s:any)=>String(s.fulfillment.order.orderNo)===r.order_no&&s.fulfillment.fulfillmentKey===r.fulfillment_key&&s.carrier===r.carrier&&s.trackingNo===r.tracking_no);
   if(matches.length!==1){result.reason='找不到唯一匹配的訂單／配送批次／物流商／貨運單，請先至出貨作業登錄。';continue;}
   const s=matches[0],current=state.get(s.shipmentId)!;result.from=current.status;
   if(s.fulfillment.status==='CANCELLED'||s.fulfillment.order.status==='VOIDED'){result.reason='訂單或配送批次已取消，請由原作業流程核對。';continue;}
   if(!s.providerShipmentRef){result.reason='貨運單缺少物流來源綁定，請先核對出貨資料。';continue;}
   const identity='file-v1:'+trackingHash([r.source_system,r.event_id]),hash=trackingHash(rowPayload(r)),previous=prior.find((e:any)=>e.providerEventIdentity===identity),known=seen.get(identity)??previous?.payloadHash;
   if(known){result.result=known===hash?'SKIP':'ERROR';result.reason=known===hash?'相同事件已存在，略過。':'同一來源事件編號已有不同內容，請核對來源。';continue;}
   seen.set(identity,hash);
   if(Date.parse(r.occurred_at)===Date.parse(current.time)&&r.status!==current.status){result.reason='相同時間已有不同狀態，請核對事件時間。';continue;}
   if(Date.parse(r.occurred_at)<=Date.parse(current.time)||r.status===current.status){result.result='SKIP';result.reason='較舊事件或狀態未變，略過。';continue;}
   try{decideTrackingProjection({expected:{shipmentId:s.shipmentId,provider:s.provider,providerShipmentRef:s.providerShipmentRef,currentStatus:current.status as any,currentEventTime:current.time},callbackProvider:s.provider,fact:{shipmentId:s.shipmentId,providerShipmentRef:s.providerShipmentRef,eventIdentity:identity,rawStatusCode:r.status,status:r.status as any,eventTime:r.occurred_at}});}catch{result.reason='狀態不可倒退或跳級，請補齊中間事件並重新預覽。';continue;}
   result.result='APPLY';result.reason='可更新';changes.push({row:r,shipment:s,from:current.status,identity,hash});state.set(s.shipmentId,{status:r.status,time:r.occurred_at});
  }
  results.sort((a,b)=>a.row-b.row);const fileHash=trackingHash(csv);return {fileHash,previewHash:trackingHash({fileHash,baseline,results}),rows:results,errors:[] as string[],changes,skips:results.filter(r=>r.result==='SKIP').length};
 }
 private publicPlan(plan:Awaited<ReturnType<AdminOrderTrackingService['plan']>>){const {changes,...value}=plan;return {...value,applyCount:changes.length,errorCount:plan.errors.length+plan.rows.filter(r=>r.result==='ERROR').length};}
 async preview(csv:string){return this.db.$transaction(async tx=>this.publicPlan(await this.plan(tx,csv)),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});}
 async apply(csv:string,previewHash:string,context:Context){
  return this.db.$transaction(async tx=>{
   // Serialize file imports, including retries and source event IDs across shipments.
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(19670919,1425)::text`;
   const fileHash=trackingHash(csv);const prior=await tx.auditEvent.findFirst({where:{action:'ORDER_TRACKING_FILE_IMPORTED',evidenceRef:'tracking-file:'+fileHash}});
   if(prior)return {...(prior.afterData as object),replayed:true};
   const plan=await this.plan(tx,csv,true),visible=this.publicPlan(plan);
   if(visible.errorCount||plan.previewHash!==previewHash)throw new ConflictException({code:'TRACKING_PREVIEW_CHANGED',message:'資料已變更或仍有錯誤，請重新預覽後匯入。'});
   if(!plan.changes.length)return {applied:0,skipped:plan.skips,fileHash,replayed:false};
   const correlationId=randomUUID();
   for(const c of plan.changes){
    const evidence=await tx.shipmentTrackingEventEvidence.create({data:{shipmentId:c.shipment.shipmentId,providerConnectionVersionId:c.shipment.providerConnectionVersionId,providerEventIdentity:c.identity,providerShipmentRef:c.shipment.providerShipmentRef,rawStatusCode:c.row.status,normalizedStatus:c.row.status,mappingSnapshotRef:'order-tracking-csv:v1',payloadHash:c.hash,safeEvidenceRef:`tracking-file:${fileHash}:row:${c.row.row}`,eventTime:new Date(c.row.occurred_at),verifiedAt:new Date(),correlationId}});
    await tx.shipmentStateTransition.create({data:{shipmentId:c.shipment.shipmentId,shipmentTrackingEventEvidenceId:evidence.shipmentTrackingEventEvidenceId,fromStatus:c.from,toStatus:c.row.status,businessEffectIdentity:c.identity,operationHash:c.hash,occurredAt:new Date(c.row.occurred_at),correlationId}});
    await tx.shipment.update({where:{shipmentId:c.shipment.shipmentId},data:{status:c.row.status}});
   }
   const summary={fileHash,applied:plan.changes.length,skipped:plan.skips,events:plan.changes.map(c=>({source:c.row.source_system,event:c.row.event_id,externalOrder:c.row.external_order_no,note:c.row.note,row:c.row.row,orderNo:c.row.order_no,from:c.from,to:c.row.status}))};
   await this.audit.write(tx,{actorType:'ADMIN',actorId:context.actorId,actorRoleSnapshot:context.role,action:'ORDER_TRACKING_FILE_IMPORTED',entityType:'SHIPMENT',evidenceRef:'tracking-file:'+fileHash,afterData:summary,requestId:context.requestId,correlationId});return {...summary,replayed:false};
  },{timeout:15000});
 }
}
