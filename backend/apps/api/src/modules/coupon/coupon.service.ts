import {Injectable,ConflictException,NotFoundException} from '@nestjs/common';
import {PrismaService,Prisma} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {randomUUID} from 'node:crypto';
import {quoteEntry,ENTRY_RULE} from './entry-pricing';
@Injectable()
export class CouponService{
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService){}
 async quote(personId:string,packageVersionId:string,code?:string){
  const now=new Date(),v=await this.db.packageProfileVersion.findUnique({where:{packageProfileVersionId:packageVersionId},include:{profile:true}});
  if(!v||v.profile.status!=='ACTIVE'||v.status!=='ACTIVE'||!v.effectiveFrom||v.effectiveFrom>now||v.effectiveTo&&v.effectiveTo<=now||v.salesFrom&&v.salesFrom>now||v.salesTo&&v.salesTo<=now)throw new ConflictException({code:'PACKAGE_VERSION_STALE_OR_NOT_SELLABLE'});
  return quoteEntry(this.db,v,code,personId,now);
 }
 async list(){return this.db.couponDefinition.findMany({orderBy:{createdAt:'desc'},include:{_count:{select:{redemptions:true}}}});}
 recordFeeRefund(orderId:string,input:{referenceNo:string;occurredAt:string;reason:string},key:string,requestId:string,actor:string){return this.idempotency.execute('admin:qualification-fee-refund:'+orderId,key,input,async tx=>{
  await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${orderId}::uuid FOR UPDATE`;
  const order=await tx.order.findUnique({where:{orderId}}),purchase=await tx.packagePurchaseSnapshot.findUnique({where:{orderId}});
  if(!order?.qualificationId||!order.paidAt||!['PAID','PARTIAL_RETURN','RETURNED','FULFILLED'].includes(order.status)||!purchase?.qualificationFee.eq(600))throw new ConflictException({code:'QUALIFICATION_FEE_REFUND_NOT_ELIGIBLE'});
  if(await tx.paymentEvent.findFirst({where:{orderId,eventType:'QUALIFICATION_FEE_REFUNDED'}}))throw new ConflictException({code:'QUALIFICATION_FEE_ALREADY_REFUNDED'});
  const setup=await tx.qualificationSetup.findUnique({where:{qualificationId:order.qualificationId}}),qualification=await tx.qualification.findUniqueOrThrow({where:{qualificationId:order.qualificationId}});
  if(!setup||setup.placedAt&&!['CLOSED','EXITED'].includes(qualification.status))throw new ConflictException({code:'QUALIFICATION_EXIT_REVIEW_REQUIRED'});
  const returned=await tx.returnLine.aggregate({where:{returnCase:{orderId,status:'POSTED'}},_sum:{returnAmount:true}});
  if(!(returned._sum.returnAmount??new Prisma.Decimal(0)).eq(purchase.priceAmount))throw new ConflictException({code:'RETURN_ALL_GOODS_BEFORE_FEE_REFUND'});
  const at=new Date(input.occurredAt);if(!Number.isFinite(at.getTime())||at<order.paidAt||at.getTime()>Date.now()+60000||!input.referenceNo.trim()||!input.reason.trim())throw new ConflictException({code:'REFUND_EVIDENCE_INVALID'});
  const correlationId=randomUUID(),event=await tx.paymentEvent.create({data:{orderId,eventType:'QUALIFICATION_FEE_REFUNDED',amount:purchase.qualificationFee,paymentMethod:'MANUAL_REFUND_CONFIRMED',referenceNo:input.referenceNo.trim(),occurredAt:at,createdBy:actor,idempotencyKey:'qualification-fee-refund:'+orderId,correlationId}});
  if(!setup.placedAt)await tx.qualificationSetup.update({where:{qualificationId:order.qualificationId},data:{setupStatus:'REVERSED',placementRequestedAt:null,placementDueAt:null}});
  await tx.order.update({where:{orderId},data:{status:'RETURNED'}});
  await this.audit.write(tx,{actorType:'USER',actorId:actor,action:'QUALIFICATION_FEE_REFUND_RECORDED',entityType:'ORDER',entityId:orderId,afterData:{paymentEventId:event.paymentEventId,amount:'600.00',referenceNo:input.referenceNo,reason:input.reason,occurredAt:at.toISOString(),manualEvidenceOnly:true},requestId,correlationId});
  return {orderId,paymentEventId:event.paymentEventId,amount:'600.00',status:'RECORDED'};
 });}
 async usage(id:string,page=1){
  const where={couponId:id},take=50,skip=(Math.max(1,Math.min(100000,page||1))-1)*take;
  const [total,rows]=await Promise.all([this.db.couponRedemption.count({where}),this.db.couponRedemption.findMany({where,orderBy:[{reservedAt:'desc'},{id:'desc'}],skip,take,include:{order:{select:{status:true,netAmount:true,qualificationId:true,orderNo:true}}}})]);
  const events=await this.db.couponUsageEvent.findMany({where:{orderId:{in:rows.map(r=>r.orderId)}},orderBy:{occurredAt:'asc'}});
  return {total,page,rows:rows.map(r=>({...r,order:{...r.order,orderNo:r.order.orderNo.toString()},state:r.redeemedAt?r.order.status:r.order.status!=='CONFIRMED'?r.order.status:r.expiresAt<=new Date()?'EXPIRED':'RESERVED',events:events.filter(e=>e.orderId===r.orderId)}))};
 }
 save(id:string|undefined,input:any,key:string,requestId:string,actor:string){return this.idempotency.execute('admin:coupon:'+actor,key,{id,...input},async tx=>{
  const startsAt=new Date(input.startsAt),endsAt=new Date(input.endsAt);
  if(endsAt<=startsAt)throw new ConflictException({code:'INVALID_COUPON_WINDOW'});
  let before=null;
  if(id){await tx.$queryRaw`SELECT id FROM commerce.coupon_definition WHERE id=${id}::uuid FOR UPDATE`;before=await tx.couponDefinition.findUnique({where:{id}});if(!before)throw new NotFoundException();if(before.revision!==input.revision)throw new ConflictException({code:'COUPON_REVISION_CONFLICT',message:'優惠碼已被其他人更新，請重新載入。'});}
  const data={name:input.name,category:'QUALIFICATION',ruleCode:ENTRY_RULE,description:'資格套組減 14,400 元，可選主商品減少 3 盒；每個資格建立費 600 元另計。活躍及領獎條件另行判定。',packageCodes:[...new Set(input.packageCodes)] as string[],startsAt,endsAt,maxUses:input.maxUses,perPersonLimit:input.perPersonLimit,enabled:input.enabled};
  const row=before?await tx.couponDefinition.update({where:{id},data:{...data,revision:{increment:1}}}):await tx.couponDefinition.create({data:{...data,code:input.code.toUpperCase()}});
  await this.audit.write(tx,{actorType:'USER',actorId:actor,action:before?'COUPON_UPDATED':'COUPON_CREATED',entityType:'Coupon',entityId:row.id,beforeData:before?JSON.parse(JSON.stringify(before)):undefined,afterData:JSON.parse(JSON.stringify(row)),requestId,correlationId:randomUUID()});
  return row;
 });}
}
