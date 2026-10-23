import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {MemberService} from './member.service';
import {FormalKycStorageService} from './formal-kyc-storage.service';
import {orderTab} from './order-hub-state';
import {MEDIA_PART_SIZE,REVIEW_MIMES,decodeReviewPart,reviewMediaLimit,validReviewMedia} from './product-review-media';
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
type Media={media_id:string;order_id:string;person_id:string;product_id:string;mime_type:string;byte_size:number;sha256:string;object_key:string;status:string;created_at:Date};
type Review={review_id:string;order_id:string;person_id:string;product_id:string;rating:number;comment:string;media_ids:string[];status:string;version:number;moderation_reason:string;created_at:Date;updated_at:Date};
export type ReviewInput={productId:string;rating:number;comment:string;mediaIds:string[];expectedVersion:number;publishConsent:boolean};
@Injectable()
export class ProductReviewService{
 constructor(private readonly db:PrismaService,private readonly members:MemberService,private readonly storage:FormalKycStorageService,private readonly audit:AuditService){}
 private async owned(tx:any,personId:string,orderNo:string,productId?:string){
  const qualifications=await this.members.qualifications(personId),packages=await tx.packagePurchaseSnapshot.findMany({where:{personId},select:{orderId:true}});
  const order=await tx.order.findFirst({where:{orderNo:BigInt(orderNo),OR:[{purchaserPersonId:personId},{qualificationId:{in:qualifications.map(q=>q.id)}},{orderId:{in:packages.map((p:any)=>p.orderId)}}]},include:{lines:true,payments:true,fulfillments:{include:{shipments:true}}}});
  if(!order||productId&&!order.lines.some((l:any)=>l.productId===productId))throw new NotFoundException({code:'REVIEW_ORDER_NOT_FOUND'});
  return order;
 }
 private eligible(order:any){if(orderTab(order)!=='REVIEW')throw new ConflictException({code:'REVIEW_NOT_DELIVERED'});}
 private mediaValue(m:Media){return {id:m.media_id,mimeType:m.mime_type,size:m.byte_size};}
 private reviewValue(r:Review,media:Media[]){return {id:r.review_id,rating:r.rating,comment:r.comment,status:r.status,version:r.version,reason:r.moderation_reason,createdAt:r.created_at.toISOString(),media:r.media_ids.map(id=>media.find(m=>m.media_id===id)).filter((m):m is Media=>!!m).map(m=>this.mediaValue(m))};}
 async own(personId:string,orderNo:string){
  const order=await this.owned(this.db,personId,orderNo),reviews=await this.db.$queryRaw<Review[]>`SELECT * FROM commerce.product_review WHERE order_id=${order.orderId}::uuid AND person_id=${personId}::uuid`,media=await this.db.$queryRaw<Media[]>`SELECT * FROM commerce.product_review_media WHERE order_id=${order.orderId}::uuid AND person_id=${personId}::uuid AND status='READY' ORDER BY created_at`;
  const products=[...new Map<string,any>(order.lines.map((l:any)=>[l.productId,l])).values()];return {eligible:orderTab(order)==='REVIEW',products:products.map(l=>({id:l.productId,name:l.productNameSnapshot,sku:l.skuSnapshot,review:reviews.find(r=>r.product_id===l.productId)?this.reviewValue(reviews.find(r=>r.product_id===l.productId)!,media):null,uploads:media.filter(m=>m.product_id===l.productId).map(m=>this.mediaValue(m))}))};
 }
 async startUpload(personId:string,orderNo:string,input:{productId:string;mimeType:string;size:number;sha256:string}){
  if(!REVIEW_MIMES.includes(input.mimeType)||input.size>reviewMediaLimit(input.mimeType))throw new BadRequestException({code:'REVIEW_MEDIA_SIZE'});
  const order=await this.owned(this.db,personId,orderNo,input.productId);this.eligible(order);
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${personId}))::text`;
   const locked=await tx.$queryRaw<{status:string}[]>`SELECT status FROM commerce.product_review WHERE order_id=${order.orderId}::uuid AND person_id=${personId}::uuid AND product_id=${input.productId}::uuid`;
   if(locked.length&&locked[0].status!=='REJECTED')throw new ConflictException({code:'REVIEW_LOCKED'});
   await tx.$executeRaw`DELETE FROM commerce.product_review_media_chunk WHERE media_id IN (SELECT media_id FROM commerce.product_review_media WHERE person_id=${personId}::uuid AND status='UPLOADING' AND created_at<now()-interval '1 day')`;
   const old=await tx.$queryRaw<Media[]>`SELECT * FROM commerce.product_review_media WHERE order_id=${order.orderId}::uuid AND person_id=${personId}::uuid AND product_id=${input.productId}::uuid AND sha256=${input.sha256}`;
   if(old.length){if(old[0].mime_type!==input.mimeType||old[0].byte_size!==input.size)throw new ConflictException({code:'REVIEW_MEDIA_INVALID'});if(old[0].status==='UPLOADING'&&old[0].created_at.getTime()<Date.now()-86400000)await tx.$executeRaw`UPDATE commerce.product_review_media SET created_at=now() WHERE media_id=${old[0].media_id}::uuid`;return {id:old[0].media_id,ready:old[0].status==='READY',partSize:MEDIA_PART_SIZE};}
   const [{count}]=await tx.$queryRaw<{count:number}[]>`SELECT count(*)::int AS count FROM commerce.product_review_media WHERE person_id=${personId}::uuid AND created_at>now()-interval '1 day'`;
   if(count>=24)throw new BadRequestException({code:'REVIEW_UPLOAD_LIMIT'});
   const id=randomUUID();await tx.$executeRaw`INSERT INTO commerce.product_review_media(media_id,order_id,person_id,product_id,mime_type,byte_size,sha256,object_key) VALUES(${id}::uuid,${order.orderId}::uuid,${personId}::uuid,${input.productId}::uuid,${input.mimeType},${input.size},${input.sha256},${'product-reviews/'+personId+'/'+id})`;
   return {id,ready:false,partSize:MEDIA_PART_SIZE};
  });
 }
 async uploadPart(personId:string,id:string,part:number,content:string){
  const bytes=decodeReviewPart(content),hash=digest(bytes);
  return this.db.$transaction(async tx=>{
   const [m]=await tx.$queryRaw<Media[]>`SELECT * FROM commerce.product_review_media WHERE media_id=${id}::uuid AND person_id=${personId}::uuid FOR UPDATE`;
   if(!m)throw new NotFoundException({code:'REVIEW_MEDIA_NOT_FOUND'});if(m.status==='READY')return {ready:true};
   if(m.created_at.getTime()<Date.now()-86400000)throw new ConflictException({code:'REVIEW_UPLOAD_EXPIRED'});
   const expected=Math.min(MEDIA_PART_SIZE,m.byte_size-part*MEDIA_PART_SIZE);if(expected<=0||bytes.length!==expected)throw new BadRequestException({code:'REVIEW_MEDIA_INVALID'});
   const [old]=await tx.$queryRaw<{sha256:string}[]>`SELECT sha256 FROM commerce.product_review_media_chunk WHERE media_id=${id}::uuid AND part=${part}`;
   if(old){if(old.sha256!==hash)throw new ConflictException({code:'REVIEW_MEDIA_INVALID'});return {received:true};}
   await tx.$executeRaw`INSERT INTO commerce.product_review_media_chunk(media_id,part,content,sha256) VALUES(${id}::uuid,${part},${bytes},${hash})`;return {received:true};
  });
 }
 async finishUpload(personId:string,id:string){
  const [m]=await this.db.$queryRaw<Media[]>`SELECT * FROM commerce.product_review_media WHERE media_id=${id}::uuid AND person_id=${personId}::uuid`;
  if(!m)throw new NotFoundException({code:'REVIEW_MEDIA_NOT_FOUND'});if(m.status==='READY')return this.mediaValue(m);
  const chunks=await this.db.$queryRaw<{part:number;content:Buffer}[]>`SELECT part,content FROM commerce.product_review_media_chunk WHERE media_id=${id}::uuid ORDER BY part`;
  if(chunks.length!==Math.ceil(m.byte_size/MEDIA_PART_SIZE)||chunks.some((c,i)=>c.part!==i))throw new ConflictException({code:'REVIEW_UPLOAD_INCOMPLETE'});
  const bytes=Buffer.concat(chunks.map(c=>c.content));if(bytes.length!==m.byte_size||digest(bytes)!==m.sha256||!validReviewMedia(bytes,m.mime_type))throw new BadRequestException({code:'REVIEW_MEDIA_INVALID'});
  await this.storage.put(m.object_key,bytes,m.mime_type);
  await this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT media_id FROM commerce.product_review_media WHERE media_id=${id}::uuid FOR UPDATE`;await tx.$executeRaw`UPDATE commerce.product_review_media SET status='READY' WHERE media_id=${id}::uuid`;await tx.$executeRaw`DELETE FROM commerce.product_review_media_chunk WHERE media_id=${id}::uuid`;});return this.mediaValue(m);
 }
 async submit(personId:string,orderNo:string,input:ReviewInput,requestId:string){
  if(!input.publishConsent)throw new BadRequestException({code:'REVIEW_CONSENT_REQUIRED'});
  if(new Set(input.mediaIds).size!==input.mediaIds.length)throw new BadRequestException({code:'REVIEW_MEDIA_INVALID'});
  return this.db.$transaction(async tx=>{
   const order=await this.owned(tx,personId,orderNo,input.productId);
   await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${order.orderId}::uuid FOR UPDATE`;
   const current=await this.owned(tx,personId,orderNo,input.productId);this.eligible(current);
   const [old]=await tx.$queryRaw<Review[]>`SELECT * FROM commerce.product_review WHERE order_id=${order.orderId}::uuid AND person_id=${personId}::uuid AND product_id=${input.productId}::uuid FOR UPDATE`;
   const comment=input.comment.trim();if(old&&old.status!=='REJECTED'){if(old.rating===input.rating&&old.comment===comment&&JSON.stringify(old.media_ids)===JSON.stringify(input.mediaIds))return {id:old.review_id,status:old.status,version:old.version};throw new ConflictException({code:'REVIEW_LOCKED'});}
   if((old?.version??0)!==input.expectedVersion)throw new ConflictException({code:'REVIEW_VERSION_CHANGED'});
   const media=input.mediaIds.length?await tx.$queryRaw<Media[]>(Prisma.sql`SELECT * FROM commerce.product_review_media WHERE media_id IN (${Prisma.join(input.mediaIds.map(id=>Prisma.sql`${id}::uuid`))})`):[];
   if(media.length!==input.mediaIds.length||media.some(m=>m.person_id!==personId||m.order_id!==order.orderId||m.product_id!==input.productId||m.status!=='READY'))throw new BadRequestException({code:'REVIEW_MEDIA_INVALID'});
   if(media.filter(m=>!m.mime_type.startsWith('image/')).length>1)throw new BadRequestException({code:'REVIEW_MEDIA_LIMIT'});
   const id=old?.review_id??randomUUID(),ids=input.mediaIds;
   if(old)await tx.$executeRaw`UPDATE commerce.product_review SET rating=${input.rating},comment=${comment},media_ids=${ids}::uuid[],status='PENDING',version=version+1,moderation_reason='',moderated_by=NULL,moderated_at=NULL,updated_at=now() WHERE review_id=${id}::uuid`;
   else await tx.$executeRaw`INSERT INTO commerce.product_review(review_id,order_id,person_id,product_id,rating,comment,media_ids) VALUES(${id}::uuid,${order.orderId}::uuid,${personId}::uuid,${input.productId}::uuid,${input.rating},${comment},${ids}::uuid[])`;
   await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'PRODUCT_REVIEW_SUBMITTED',entityType:'ProductReview',entityId:id,afterData:{rating:input.rating,attachmentCount:ids.length,version:(old?.version??0)+1,publishConsent:true},requestId,correlationId:randomUUID()});return {id,status:'PENDING',version:(old?.version??0)+1};
  },{timeout:15000});
 }
 async publicList(sku:string,page=1,rating?:number){
  const product=await this.db.productReference.findUnique({where:{sku}});if(!product?.isActive)throw new NotFoundException();
  return this.db.$transaction(async tx=>{
   const filter=rating?Prisma.sql`AND rating=${rating}`:Prisma.empty;
   const distribution=await tx.$queryRaw<{rating:number;count:number}[]>`SELECT rating,count(*)::int AS count FROM commerce.product_review WHERE product_id=${product.productId}::uuid AND status='APPROVED' GROUP BY rating ORDER BY rating DESC`;
   const total=distribution.reduce((n,r)=>n+r.count,0),filtered=rating?distribution.find(r=>r.rating===rating)?.count??0:total,pages=Math.max(1,Math.ceil(filtered/10)),current=Math.min(page,pages);
   const rows=await tx.$queryRaw<Review[]>(Prisma.sql`SELECT * FROM commerce.product_review WHERE product_id=${product.productId}::uuid AND status='APPROVED' ${filter} ORDER BY created_at DESC,review_id LIMIT 10 OFFSET ${(current-1)*10}`);
   const allIds=rows.flatMap(r=>r.media_ids),media=allIds.length?await tx.$queryRaw<Media[]>(Prisma.sql`SELECT * FROM commerce.product_review_media WHERE media_id IN (${Prisma.join(allIds.map(id=>Prisma.sql`${id}::uuid`))}) AND status='READY'`):[];
   return {total,average:total?Math.round(distribution.reduce((n,r)=>n+r.rating*r.count,0)/total*10)/10:null,distribution,page:current,pages,filtered,reviews:rows.map(r=>({id:r.review_id,rating:r.rating,comment:r.comment,createdAt:r.created_at.toISOString(),author:'已驗證購買會員',media:r.media_ids.map(id=>media.find(m=>m.media_id===id)).filter((m):m is Media=>!!m).map(m=>this.mediaValue(m))}))};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async adminList(status:string,page=1){
  return this.db.$transaction(async tx=>{
   const distribution=await tx.$queryRaw<{status:string;count:number}[]>`SELECT status,count(*)::int AS count FROM commerce.product_review GROUP BY status`;
   const filter=status==='ALL'?Prisma.empty:Prisma.sql`WHERE r.status=${status}`;
   const total=status==='ALL'?distribution.reduce((n,r)=>n+r.count,0):distribution.find(r=>r.status===status)?.count??0,pages=Math.max(1,Math.ceil(total/20)),current=Math.min(page,pages);
   const reviews=await tx.$queryRaw<(Review&{order_no:string;product_name:string;sku:string})[]>(Prisma.sql`SELECT r.*,o.order_no::text,p.display_name AS product_name,p.sku FROM commerce.product_review r JOIN commerce."order" o USING(order_id) JOIN commerce.product_reference p USING(product_id) ${filter} ORDER BY r.updated_at DESC,r.review_id LIMIT 20 OFFSET ${(current-1)*20}`);
   const ids=reviews.flatMap(r=>r.media_ids),media=ids.length?await tx.$queryRaw<Media[]>(Prisma.sql`SELECT * FROM commerce.product_review_media WHERE media_id IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))})`):[];
   return {counts:Object.fromEntries(distribution.map(r=>[r.status,r.count])),total,page:current,pages,reviews:reviews.map(r=>({...this.reviewValue(r,media),orderNo:r.order_no,productName:r.product_name,sku:r.sku}))};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async moderate(id:string,action:'APPROVED'|'REJECTED'|'HIDDEN',version:number,reason:string,actor:string,requestId:string){
  if(action!=='APPROVED'&&!reason.trim())throw new BadRequestException({code:'REVIEW_REASON_REQUIRED'});
  return this.db.$transaction(async tx=>{
   const [review]=await tx.$queryRaw<Review[]>`SELECT * FROM commerce.product_review WHERE review_id=${id}::uuid FOR UPDATE`;
   if(!review)throw new NotFoundException();if(review.version!==version)throw new ConflictException({code:'REVIEW_VERSION_CHANGED'});
   if(review.status===action)return {status:action,version};
   if(action==='HIDDEN'?review.status!=='APPROVED':review.status!=='PENDING')throw new ConflictException({code:'REVIEW_VERSION_CHANGED'});
   await tx.$executeRaw`UPDATE commerce.product_review SET status=${action},moderation_reason=${reason.trim()},moderated_by=${actor}::uuid,moderated_at=now(),updated_at=now() WHERE review_id=${id}::uuid`;
   await this.audit.write(tx,{actorType:'ADMIN',actorId:actor,action:'PRODUCT_REVIEW_MODERATED',entityType:'ProductReview',entityId:id,beforeData:{status:review.status},afterData:{status:action,version,reason:reason.trim()},requestId,correlationId:randomUUID()});return {status:action,version};
  });
 }
 async media(id:string,scope:{personId?:string;admin?:boolean;public?:boolean}){
  const [m]=await this.db.$queryRaw<Media[]>`SELECT * FROM commerce.product_review_media WHERE media_id=${id}::uuid AND status='READY'`;if(!m)throw new NotFoundException();
  if(scope.public){const [{count}]=await this.db.$queryRaw<{count:number}[]>`SELECT count(*)::int AS count FROM commerce.product_review WHERE status='APPROVED' AND ${id}::uuid=ANY(media_ids)`;if(!count)throw new NotFoundException();}
  else if(!scope.admin&&m.person_id!==scope.personId)throw new ForbiddenException();
  if(!m.object_key.startsWith('product-reviews/'))throw new ForbiddenException();const stored=await this.storage.get(m.object_key);return {bytes:stored.bytes,mimeType:m.mime_type};
 }
}
