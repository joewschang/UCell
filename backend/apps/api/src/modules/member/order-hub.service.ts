import {randomUUID} from 'node:crypto';
import {Injectable,NotFoundException,ConflictException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {MemberService} from './member.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {AuditService} from '../../common/audit/audit.service';
import {orderTab} from './order-hub-state';
type Review={order_id:string;person_id:string;rating:number;comment:string;created_at:Date};
@Injectable()
export class OrderHubService{
 constructor(private readonly db:PrismaService,private readonly identity:MemberService,private readonly idem:IdempotencyService,private readonly audit:AuditService){}
 private async scope(tx:any,personId:string){const owned=await this.identity.qualifications(personId);const packages=await tx.packagePurchaseSnapshot.findMany({where:{personId},select:{orderId:true,packageName:true,paymentDeadline:true}});return {packages,where:{OR:[{purchaserPersonId:personId},{orderId:{in:packages.map((p:any)=>p.orderId)}},{qualificationId:{in:owned.map(q=>q.id)}}]}};}
 async list(personId:string,query:{tab?:string;search?:string;page?:number}){
 return this.db.$transaction(async tx=>{
 const {packages,where}=await this.scope(tx,personId);
 const orders=await tx.order.findMany({where,include:{lines:true,payments:{orderBy:{createdAt:'desc'}},fulfillments:{include:{shipments:{orderBy:{createdAt:'asc'}}}}},orderBy:[{createdAt:'desc'},{orderId:'desc'}]});
 const reviews=await tx.$queryRaw<Review[]>`SELECT order_id,person_id,rating,comment,created_at FROM commerce.member_order_review WHERE person_id=${personId}::uuid`;
 const counts:Record<string,number>={PAYMENT:0,SHIPPING:0,RECEIVING:0,REVIEW:0,ALL:orders.length};
 const mapped=orders.map(o=>{const review=reviews.find(r=>r.order_id===o.orderId),tab=orderTab(o,!!review);if(tab in counts)counts[tab]++;const pack=packages.find((p:any)=>p.orderId===o.orderId);return {orderNo:o.orderNo.toString(),status:o.status,tab,total:o.netAmount.toString(),createdAt:o.createdAt.toISOString(),purpose:o.purpose,packageName:pack?.packageName??null,paymentDeadline:pack?.paymentDeadline?.toISOString()??null,paymentStatus:o.payments.find(p=>['REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED'].includes(p.status))?.status??(o.paidAt?'PAID':o.payments[0]?.status??'PENDING'),paidAt:o.paidAt?.toISOString()??null,items:o.lines.map(l=>({name:l.productNameSnapshot,sku:l.skuSnapshot,quantity:l.quantity.toString(),amount:l.lineAmount.toString()})),fulfillments:o.fulfillments.map(f=>({status:f.status,shipments:f.shipments.map(s=>({carrier:s.carrier,trackingNo:s.trackingNo,status:s.status,updatedAt:s.updatedAt.toISOString()}))})),review:review?{rating:review.rating,comment:review.comment,createdAt:review.created_at.toISOString()}:null};});
 const search=(query.search??'').trim().toLocaleLowerCase(),filtered=mapped.filter(o=>(!query.tab||query.tab==='ALL'||o.tab===query.tab)&&(!search||[o.orderNo,o.packageName,...o.items.map(i=>i.name)].join(' ').toLocaleLowerCase().includes(search))),pages=Math.max(1,Math.ceil(filtered.length/20)),page=Math.min(query.page??1,pages);
 return {counts,orders:filtered.slice((page-1)*20,page*20),page,pages,total:filtered.length,asOf:new Date().toISOString()};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async review(personId:string,orderNo:string,input:{rating:number;comment?:string},key:string,requestId:string){
 const result=await this.idem.execute(`member:order-review:${personId}`,key,{orderNo,...input},async tx=>{
 const {where}=await this.scope(tx,personId);
 const order=await tx.order.findFirst({where:{AND:[where,{orderNo:BigInt(orderNo)}]},include:{payments:true,fulfillments:{include:{shipments:true}}}});
 if(!order)throw new NotFoundException({code:'ORDER_NOT_FOUND',message:'找不到可供您評價的訂單。'});
 await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${order.orderId}::uuid FOR UPDATE`;
 // Re-read delivery and payment facts after taking the order lock.
 const current=await tx.order.findUniqueOrThrow({where:{orderId:order.orderId},include:{payments:true,fulfillments:{include:{shipments:true}}}});
 if(orderTab(current)!=='REVIEW')throw new ConflictException({code:'ORDER_NOT_DELIVERED',message:'訂單尚未全數送達，或正在退貨退款處理中，目前無法評價。'});
 const existing=await tx.$queryRaw<Review[]>`SELECT order_id,person_id,rating,comment,created_at FROM commerce.member_order_review WHERE order_id=${order.orderId}::uuid AND person_id=${personId}::uuid`;
 const comment=(input.comment??'').trim();
 if(existing.length){if(existing[0].rating===input.rating&&existing[0].comment===comment)return {rating:existing[0].rating,comment,createdAt:existing[0].created_at.toISOString()};throw new ConflictException({code:'ORDER_ALREADY_REVIEWED',message:'這筆訂單已完成評價，請重新整理查看。'});}
 const rows=await tx.$queryRaw<Review[]>`INSERT INTO commerce.member_order_review(order_id,person_id,rating,comment) VALUES(${order.orderId}::uuid,${personId}::uuid,${input.rating},${comment}) RETURNING order_id,person_id,rating,comment,created_at`;
 await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'ORDER_REVIEW_CREATED',entityType:'ORDER',entityId:order.orderId,afterData:{rating:input.rating},requestId:requestId??randomUUID(),correlationId:randomUUID()});
 return {rating:rows[0].rating,comment,createdAt:rows[0].created_at.toISOString()};
 });return result.value;
 }
}
