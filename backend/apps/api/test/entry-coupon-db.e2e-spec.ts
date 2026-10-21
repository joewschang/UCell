import {ReturnService} from '../src/modules/return/return.service';
import {randomUUID} from 'node:crypto';
import {ConfigService} from '@nestjs/config';
import {PrismaService,qualificationPackageAllocation,recognizeQualificationPackage} from '@ucell/database';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {OutboxService} from '../src/common/outbox/outbox.service';
import {OrderService} from '../src/modules/order/order.service';
import {PackageConfigService} from '../src/modules/package-config/package-config.service';
import {FormalEnrollmentService} from '../src/modules/member/formal-enrollment.service';
import {CouponService} from '../src/modules/coupon/coupon.service';
import {quoteEntry} from '../src/modules/coupon/entry-pricing';
describe('Entry coupon isolated database invariants',()=>{
 const db=new PrismaService(),audit=new AuditService(),idem=new IdempotencyService(db),orders=new OrderService(db,idem,audit,new OutboxService()),packages=new PackageConfigService(db),coupons=new CouponService(db,idem,audit);
 const offers:Record<string,{id:string;rule:string}>={};let personId:string;
 beforeAll(async()=>{
  const u=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(u.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(u.pathname))throw Error('Isolated harness required');
  personId=(await db.person.create({data:{legalName:'TEST ONLY COUPON',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}})).personId;
  for(const [code,quantity,price] of [['STARTER',3,14400],['ELITE',9,43200],['LEADER',15,72000]] as const){
   const product=await db.productReference.create({data:{sku:'TEST-'+randomUUID(),displayName:'TEST ONLY',currentPrice:'4800'}}),rule=await db.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:new Date(Date.now()-60000),gpvRate:0,pvRate:0,ruleVersionCode:'R1.0B',parameterSnapshotHash:'a'.repeat(64)}}),profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:code}});
   const v=await packages.addVersion(profile.packageProfileId,{displayName:'TEST '+code,currency:'TWD',priceAmount:String(price),selectableProductQuantity:quantity,membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,recognitionConfigRef:'R1.0B'},'creator');
   await packages.setProducts(v.packageProfileVersionId,[{productRuleProfileId:rule.productRuleProfileId,minQty:1,maxQty:quantity}]);await packages.approve(v.packageProfileVersionId,'TEST','approver');await packages.schedule(v.packageProfileVersionId,{effectiveFrom:new Date(Date.now()-1000).toISOString()});await packages.activate(v.packageProfileVersionId);
   offers[code]={id:v.packageProfileVersionId,rule:rule.productRuleProfileId};
  }
 },60000);
 afterAll(()=>db.$disconnect());
 async function create(code='STARTER',couponCode:string|undefined='UCELL888'){
  const f=offers[code],q=await coupons.quote(personId,f.id,couponCode),key=randomUUID(),body={packageVersionId:f.id,couponCode,quoteHash:q.quoteHash,selections:q.selectableProductQuantity?[{productRuleProfileId:f.rule,quantity:q.selectableProductQuantity}]:[]};
  const r=await orders.createMember(body,key,'test',personId);return {r,body,key,q};
 }
 it.each([['STARTER',0,'600.00'],['ELITE',6,'29400.00'],['LEADER',12,'58200.00']])('prices, reserves, pays and recognizes %s without fee volume or automatic Active',async(code,qty,total)=>{
  const {r,body,key,q}=await create(code as string);expect(q.total).toBe(total);expect(q.selectableProductQuantity).toBe(qty);
  expect((await orders.createMember(body,key,'retry',personId)).value.orderId).toBe(r.value.orderId);
  const orderId=r.value.orderId,p=await db.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId}}),o=await db.order.findUniqueOrThrow({where:{orderId},include:{lines:true}});
  expect(p.qualificationFee.toString()).toBe('600');expect(p.discountAmount.toString()).toBe('14400');expect(o.lines.length).toBe(qty?1:0);
  expect(qualificationPackageAllocation(p,o.lines,o.netAmount).gpvPerBox.toString()).toBe(qty?'2880':'0');
  await orders.confirmPayment(orderId,{amount:q.total,paymentMethod:'BANK_TRANSFER',referenceNo:'TEST-'+randomUUID(),occurredAt:new Date().toISOString()},randomUUID(),'test');
  expect(await db.$transaction(tx=>recognizeQualificationPackage(tx,orderId,randomUUID()))).toMatchObject({status:'AWAITING_PLACEMENT'});
  expect(await db.activePeriod.count({where:{qualificationId:o.qualificationId!}})).toBe(0);
  expect((await db.couponRedemption.findUniqueOrThrow({where:{orderId}})).redeemedAt).not.toBeNull();expect(await db.couponUsageEvent.count({where:{orderId,kind:'PAID'}})).toBe(1);
  await expect(db.couponRedemption.update({where:{orderId},data:{snapshot:{tampered:true}}})).rejects.toThrow();
 });
 it('charges 600 outside promotions and rejects stale or excessive selection',async()=>{
  const q=await coupons.quote(personId,offers.STARTER.id);expect(q.total).toBe('15000.00');expect(q.selectableProductQuantity).toBe(3);
  await expect(orders.createMember({packageVersionId:offers.ELITE.id,couponCode:'UCELL888',selections:[{productRuleProfileId:offers.ELITE.rule,quantity:9}]},randomUUID(),'test',personId)).rejects.toThrow();
  await expect(orders.createMember({packageVersionId:offers.STARTER.id,couponCode:'UCELL888',quoteHash:'0'.repeat(64),selections:[]},randomUUID(),'test',personId)).rejects.toThrow();
 });
 it('honors the inclusive Taiwan Jan31 day and unlimited repeat uses',async()=>{
  const v=await db.packageProfileVersion.findUniqueOrThrow({where:{packageProfileVersionId:offers.STARTER.id},include:{profile:true}});
  expect((await quoteEntry(db,v,'ucell888',personId,new Date('2027-01-31T15:59:59.999Z'))).total).toBe('600.00');
  await expect(quoteEntry(db,v,'UCELL888',personId,new Date('2027-01-31T16:00:00Z'))).rejects.toThrow();
  const a=await create(),b=await create();expect(a.r.value.orderId).not.toBe(b.r.value.orderId);
 });
 it('serializes limited coupons and releases cancelled unpaid reservations',async()=>{
  const c=await db.couponDefinition.findUniqueOrThrow({where:{code:'UCELL888'}});
  await coupons.save(undefined,{code:'TESTLIMIT',name:'TEST',packageCodes:['STARTER'],startsAt:c.startsAt.toISOString(),endsAt:c.endsAt.toISOString(),maxUses:1,perPersonLimit:0,enabled:true},randomUUID(),'test',personId);
  const attempts=await Promise.allSettled([create('STARTER','TESTLIMIT'),create('STARTER','TESTLIMIT')]);expect(attempts.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const first=(attempts.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;
  await db.order.update({where:{orderId:first.r.value.orderId},data:{status:'VOIDED'}});await create('STARTER','TESTLIMIT');
  expect(await db.couponUsageEvent.count({where:{orderId:first.r.value.orderId,kind:'VOIDED'}})).toBe(1);
 });
 it('rejects late payment at both service and database boundaries',async()=>{
  await coupons.save(undefined,{code:'TESTEXPIRY',name:'TEST',packageCodes:['STARTER'],startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+2000).toISOString(),maxUses:0,perPersonLimit:0,enabled:true},randomUUID(),'test',personId);
  const {r}=await create('STARTER','TESTEXPIRY');await new Promise(resolve=>setTimeout(resolve,2100));
  await expect(orders.confirmPayment(r.value.orderId,{amount:'600',paymentMethod:'BANK_TRANSFER',referenceNo:'TEST',occurredAt:new Date().toISOString()},randomUUID(),'test')).rejects.toThrow();
  await expect(db.order.update({where:{orderId:r.value.orderId},data:{status:'PAID',paidAt:new Date()}})).rejects.toThrow();
  const c=await db.couponDefinition.findUniqueOrThrow({where:{code:'TESTEXPIRY'}});expect((await coupons.usage(c.id)).rows[0].state).toBe('EXPIRED');
 });
 it('returns all discounted goods separately from the fee and blocks early fee refunds',async()=>{
 const {r,q}=await create('ELITE'),orderId=r.value.orderId;
 await orders.confirmPayment(orderId,{amount:q.total,paymentMethod:'BANK_TRANSFER',referenceNo:'TEST',occurredAt:new Date().toISOString()},randomUUID(),'test');
 await expect(coupons.recordFeeRefund(orderId,{referenceNo:'TEST',reason:'TEST',occurredAt:new Date().toISOString()},randomUUID(),'test',personId)).rejects.toMatchObject({response:{code:'RETURN_ALL_GOODS_BEFORE_FEE_REFUND'}});
 const lines=await db.orderLine.findMany({where:{orderId}});await new ReturnService(db,idem,audit,new OutboxService()).post(orderId,{reasonCode:'TEST',occurredAt:new Date().toISOString(),lines:lines.map(l=>({orderLineId:l.orderLineId,quantity:'6'}))},randomUUID(),'test',personId);
 expect((await db.order.findUniqueOrThrow({where:{orderId}})).status).toBe('RETURNED');
 const total=await db.returnLine.aggregate({where:{returnCase:{orderId}},_sum:{returnAmount:true}});expect(total._sum.returnAmount?.toString()).toBe('28800');
 expect((await coupons.recordFeeRefund(orderId,{referenceNo:'REFUND',reason:'TEST',occurredAt:new Date().toISOString()},randomUUID(),'test',personId)).value.amount).toBe('600.00');
});
it('records zero-box fee refunds once and retains redeemed usage',async()=>{
 const {r,q}=await create(),orderId=r.value.orderId;
 await orders.confirmPayment(orderId,{amount:q.total,paymentMethod:'BANK_TRANSFER',referenceNo:'TEST',occurredAt:new Date().toISOString()},randomUUID(),'test');
 const input={referenceNo:'REFUND-TEST',reason:'ISOLATED TEST',occurredAt:new Date().toISOString()},key=randomUUID();
 const recorded=await coupons.recordFeeRefund(orderId,input,key,'test',personId);expect(recorded.value.amount).toBe('600.00');expect((await coupons.recordFeeRefund(orderId,input,key,'test',personId)).replayed).toBe(true);
 await expect(coupons.recordFeeRefund(orderId,input,randomUUID(),'test',personId)).rejects.toThrow();
 expect((await db.order.findUniqueOrThrow({where:{orderId}})).status).toBe('RETURNED');expect((await db.couponRedemption.findUniqueOrThrow({where:{orderId}})).redeemedAt).not.toBeNull();
 expect((await db.qualificationSetup.findFirstOrThrow({where:{qualifyingOrderId:orderId}})).setupStatus).toBe('REVERSED');
});
it('removes fee-only enrollment and blocks production simulated payment',async()=>{
  const service=new FormalEnrollmentService(db,new ConfigService({UCELL_ENVIRONMENT:'PRODUCTION',STAGE_PAYMENT_MODE:'ASSUME_PAID'}),idem,audit,orders);
  await expect(service.payFee(personId,randomUUID(),'test')).rejects.toMatchObject({response:{code:'QUALIFICATION_PACKAGE_REQUIRED'}});
  await expect(service.payPackage(personId,randomUUID(),randomUUID(),'test')).rejects.toMatchObject({response:{code:'STAGE_PAYMENT_NOT_AVAILABLE'}});
 });
});
