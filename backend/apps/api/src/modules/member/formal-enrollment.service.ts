import {PiiCryptoService} from '../../common/security/pii-crypto.service';
import {ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Prisma,PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {OrderService} from '../order/order.service';
import {QualificationAccessService} from '../auth/qualification-access.service';

const FEE='600.00',RULE='FORMAL_ENROLLMENT_V1';
@Injectable()
export class FormalEnrollmentService{
 constructor(private readonly db:PrismaService,private readonly config:ConfigService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService,private readonly orders:OrderService){}
 stagePaymentEnabled(){
  if(this.config.get('UCELL_ENVIRONMENT')!=='STAGE'||this.config.get('STAGE_PAYMENT_MODE')!=='ASSUME_PAID')return false;
  try{
   const url=new URL(this.config.get<string>('DATABASE_URL')??'');
   return url.hostname==='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com'&&url.pathname==='/ucell_stage'
    ||this.config.get('NODE_ENV')==='test'&&['localhost','127.0.0.1'].includes(url.hostname)&&/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname);
  }catch{return false;}
 }
 private assertStage(){if(!this.stagePaymentEnabled())throw new ForbiddenException({code:'STAGE_PAYMENT_NOT_AVAILABLE'});}
 private receipt(order:{orderId:string;netAmount:Prisma.Decimal;status:string;paidAt:Date|null}){return {orderId:order.orderId,amount:order.netAmount.toFixed(2),currency:'TWD',status:order.status,paidAt:order.paidAt?.toISOString()??null,simulation:true};}
 private paidPackages(db:PrismaService|Prisma.TransactionClient,personId:string){
  return db.$queryRaw<Array<{orderId:string;packageName:string}>>`SELECT p.order_id AS "orderId",p.package_name AS "packageName" FROM commerce.package_purchase_snapshot p JOIN commerce."order" o ON o.order_id=p.order_id WHERE p.person_id=${personId}::uuid AND p.package_class='QUALIFICATION' AND p.membership_effect='FORMAL_ELIGIBILITY' AND o.status IN ('PAID','FULFILLED') ORDER BY p.purchased_at DESC LIMIT 20`;
 }
 async draft(personId:string,applicationId:string){
  const app=await this.db.formalMemberApplication.findFirst({where:{personId,formalMemberApplicationId:applicationId},include:{snapshots:{orderBy:{version:'desc'},take:1},documents:{where:{status:'PRESENT'},select:{documentType:true}}}});
  const snapshot=app?.snapshots[0];if(!snapshot)return null;
  return {payload:new PiiCryptoService().decrypt<Record<string,unknown>>(snapshot.payloadCiphertext,snapshot.keyVersion),version:snapshot.version,documents:app!.documents.map(d=>d.documentType)};
 }
 async status(personId:string){
  const person=await this.db.person.findUnique({where:{personId},select:{membershipState:true,status:true,securityStatus:true}});
  if(!person||person.status!=='EFFECTIVE'||person.securityStatus!=='NORMAL')throw new ForbiddenException({code:'MEMBER_PERSON_DISABLED'});
  const [fee,application,packages]=await Promise.all([
   this.db.order.findFirst({where:{purchaserPersonId:personId,purpose:'FORMAL_MEMBERSHIP_FEE',status:'PAID'},orderBy:{createdAt:'desc'}}),
   this.db.formalMemberApplication.findFirst({where:{personId,applicantType:'INDIVIDUAL'},select:{formalMemberApplicationId:true,status:true},orderBy:{updatedAt:'desc'}}),
   this.paidPackages(this.db,personId),
  ]);
  const pendingPackages=await this.db.packagePurchaseSnapshot.findMany({where:{personId,packageClass:'QUALIFICATION',paymentDeadline:{gt:new Date()}},orderBy:{purchasedAt:'desc'},take:20});
  const pendingOrders=await this.db.order.findMany({where:{orderId:{in:pendingPackages.map(p=>p.orderId)},status:'CONFIRMED'},select:{orderId:true,netAmount:true}});
  return {draft:application?await this.draft(personId,application.formalMemberApplicationId):null,pendingPackages:pendingPackages.filter(p=>pendingOrders.some(o=>o.orderId===p.orderId)).map(p=>({orderId:p.orderId,packageName:p.packageName,total:pendingOrders.find(o=>o.orderId===p.orderId)!.netAmount.toString(),paymentDeadline:p.paymentDeadline!.toISOString(),couponCode:p.couponCode,qualificationFee:p.qualificationFee.toString(),goodsAmount:p.priceAmount.toString(),selectableProductQuantity:p.selectableProductQuantity})),membershipState:person.membershipState,feeAmount:FEE,currency:'TWD',stagePaymentEnabled:this.stagePaymentEnabled(),feeReceipt:fee?this.receipt(fee):null,application:application?{id:application.formalMemberApplicationId,status:application.status}:null,paidPackages:packages};
 }
 private async pending(tx:Prisma.TransactionClient,personId:string,sourceId:string){
  const person=await tx.person.findUniqueOrThrow({where:{personId}});
  if(person.status!=='EFFECTIVE'||person.securityStatus!=='NORMAL'||!['NETWORK_MEMBER','FORMAL_PENDING','FORMAL_MEMBER'].includes(person.membershipState??''))throw new ConflictException({code:'NETWORK_MEMBERSHIP_REQUIRED'});
  if(person.membershipState==='NETWORK_MEMBER'){
   await tx.person.update({where:{personId},data:{membershipState:'FORMAL_PENDING'}});
   await tx.personMembershipStateEvent.create({data:{personId,fromState:'NETWORK_MEMBER',toState:'FORMAL_PENDING',reasonCode:'FORMAL_ENROLLMENT_PENDING',sourceType:'ORDER',sourceId,correlationId:randomUUID()}});
  }
 }
 async payFee(personId:string,key:string,requestId:string){
  throw new ConflictException({code:'QUALIFICATION_PACKAGE_REQUIRED',message:'請選擇會員資格套組；不再提供單獨繳費加入正式會員。'});
 }
 async payCommerce(personId:string,orderId:string,key:string,requestId:string){
  this.assertStage();
  const person=await this.db.person.findUnique({where:{personId}});
  if(!person||person.status!=='EFFECTIVE'||person.securityStatus!=='NORMAL')throw new ForbiddenException({code:'MEMBER_PERSON_DISABLED'});
  const order=await this.db.order.findUnique({where:{orderId}});
  if(!order||!['RETAIL','REPURCHASE'].includes(order.purpose))throw new NotFoundException({code:'STAGE_COMMERCE_ORDER_NOT_FOUND'});
  if(order.qualificationId)await new QualificationAccessService(this.db).assertHolder(personId,order.qualificationId);
  else if(order.purchaserPersonId!==personId)throw new NotFoundException({code:'STAGE_COMMERCE_ORDER_NOT_FOUND'});
  if(order.status!=='PAID')await this.orders.confirmPayment(orderId,{amount:order.netAmount.toFixed(2),paymentMethod:'STAGE_SIMULATED',referenceNo:'STAGE-TEST:'+orderId,occurredAt:new Date().toISOString(),note:'Stage-only assumed commerce payment; no real charge'},key,requestId);
  return this.receipt(await this.db.order.findUniqueOrThrow({where:{orderId}}));
 }
 async payPackage(personId:string,orderId:string,key:string,requestId:string){
  this.assertStage();
  const person=await this.db.person.findUnique({where:{personId}});
  if(!person||person.status!=='EFFECTIVE'||person.securityStatus!=='NORMAL'||!['NETWORK_MEMBER','FORMAL_PENDING','FORMAL_MEMBER'].includes(person.membershipState??''))throw new ConflictException({code:'FORMAL_ENROLLMENT_NOT_AVAILABLE'});
  const purchase=await this.db.packagePurchaseSnapshot.findUnique({where:{orderId}});
  if(!purchase||purchase.personId!==personId||purchase.packageClass!=='QUALIFICATION'||purchase.membershipEffect!=='FORMAL_ELIGIBILITY')throw new NotFoundException({code:'ENROLLMENT_PACKAGE_ORDER_NOT_FOUND'});
  // Use the canonical payment writer; never fabricate a provider receipt or bypass
  // the existing qualification setup/sponsor validation. The server fixes amount.
  const order=await this.db.order.findUniqueOrThrow({where:{orderId}});
  if(order.status!=='PAID')await this.orders.confirmPayment(orderId,{amount:order.netAmount.toFixed(2),paymentMethod:'STAGE_SIMULATED',referenceNo:'STAGE-TEST:'+orderId,occurredAt:new Date().toISOString(),note:'Stage-only assumed payment; not a real provider transaction'},key,requestId);
  await this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT person_id FROM identity.person WHERE person_id=${personId}::uuid FOR UPDATE`;await this.pending(tx,personId,orderId);});
  const paid=await this.db.order.findUniqueOrThrow({where:{orderId}});
  return {...this.receipt(paid),route:'PACKAGE',qualificationId:paid.qualificationId};
 }
 async submit(personId:string,applicationId:string,key:string,requestId:string,input:{orderId?:string;paymentMethod?:string}={}){
  return this.idempotency.execute('member:formal-enrollment:submit:'+personId,key,{applicationId,...input},async tx=>{
   await tx.$queryRaw`SELECT formal_member_application_id FROM identity.formal_member_application WHERE formal_member_application_id=${applicationId}::uuid FOR UPDATE`;
   const app=await tx.formalMemberApplication.findUnique({where:{formalMemberApplicationId:applicationId}});
   if(!app||app.personId!==personId||app.sourceChannel!=='MEMBER_WEB')throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
   if(['SUBMITTED','UNDER_REVIEW','APPROVED'].includes(app.status))return {applicationId,status:app.status};
   if(!['DRAFT','NEEDS_MORE_INFO'].includes(app.status))throw new ConflictException({code:'FORMAL_APPLICATION_NOT_SUBMITTABLE'});
   const fee=await tx.order.findFirst({where:{purchaserPersonId:personId,purpose:'FORMAL_MEMBERSHIP_FEE',status:'PAID'}});
   let purchase=(await this.paidPackages(tx,personId))[0];const paymentConfirmed=!!purchase;
   if(!purchase){
    if(!input.orderId||!['BANK_TRANSFER','CASH'].includes(input.paymentMethod??''))throw new ConflictException({code:'FORMAL_ENROLLMENT_PAYMENT_METHOD_REQUIRED'});
    const pending=await tx.packagePurchaseSnapshot.findUnique({where:{orderId:input.orderId}});
    const order=await tx.order.findFirst({where:{orderId:input.orderId,status:'CONFIRMED',OR:[{purchaserPersonId:personId},{purchaserPersonId:null}]}});
    if(!pending||!order||pending.personId!==personId||pending.packageClass!=='QUALIFICATION'||pending.membershipEffect!=='FORMAL_ELIGIBILITY'||!pending.paymentDeadline||pending.paymentDeadline<=new Date())throw new ConflictException({code:'FORMAL_ENROLLMENT_ORDER_NOT_AVAILABLE'});
    purchase={orderId:order.orderId,packageName:pending.packageName};
   }
   const docs=await tx.formalApplicationDocument.findMany({where:{formalMemberApplicationId:applicationId,status:'PRESENT',documentType:{in:['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','SIGNED_APPLICATION_AGREEMENT']}}});
   if(['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'].some(type=>!docs.some(d=>d.documentType===type)))throw new ConflictException({code:'FORMAL_ENROLLMENT_DOCUMENTS_REQUIRED'});
   await this.pending(tx,personId,purchase!.orderId);
   await tx.formalMemberApplication.update({where:{formalMemberApplicationId:applicationId},data:{status:'SUBMITTED',submittedAt:new Date()}});
   await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'FORMAL_ENROLLMENT_SUBMITTED',entityType:'FormalMemberApplication',entityId:applicationId,afterData:{status:'SUBMITTED',paymentOrderId:purchase!.orderId,paymentConfirmed,paymentMethod:paymentConfirmed?null:input.paymentMethod,scanApprovalGranted:false},requestId,correlationId:randomUUID()});
   return {applicationId,status:'SUBMITTED'};
  });
 }
}
