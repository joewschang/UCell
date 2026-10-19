import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {preparePackageMonthlySchedule} from '../../../packages/database/src/package-monthly-schedule';
import {preparePackageMonthlyReturn} from '../../../packages/database/src/package-monthly-return';
import {PackageConfigService} from '../src/modules/package-config/package-config.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('immutable prepaid package monthly preparation',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db.$disconnect());
 it.each([['ACTIVE_QUARTER','6000',2,3],['ACTIVE_HALF_YEAR','12000',4,6],['ACTIVE_YEAR','24000',8,12]] as const)('%s persists payment-first Taiwan monthly schedule exactly once',(async(packageCode,price,boxes,months)=>{
  const person=await db.person.create({data:{legalName:'ISOLATED MONTHLY OWNER',status:'EFFECTIVE'}});
  const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,status:'EFFECTIVE',planLevelCode:'STARTER'}});
  const profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:packageCode}});
  const version=await new PackageConfigService(db as any).addVersion(profile.packageProfileId,{displayName:'Monthly fixture',currency:'TWD',priceAmount:price,selectableProductQuantity:boxes,membershipEffect:'NONE',qualificationEffect:'ACTIVE_ENTITLEMENT',activeDurationUnit:'MONTH',activeDurationValue:months,targetQualificationRequired:true,recognitionConfigRef:'PO_20261019_REPURCHASE_60'},'fixture');
  const paidAt=new Date('2040-12-31T15:59:59.000Z');
  const order=await db.order.create({data:{qualificationId:q.qualificationId,status:'PAID',purpose:'REPURCHASE',grossAmount:price,netAmount:price,paidAt,ruleVersionCode:'R1.0B'}});
  await db.packagePurchaseSnapshot.create({data:{orderId:order.orderId,personId:person.personId,targetQualificationId:q.qualificationId,packageProfileVersionId:version.packageProfileVersionId,packageCode,packageName:'Monthly fixture',packageClass:'ACTIVE_DURATION',currency:'TWD',priceAmount:price,selectableProductQuantity:boxes,membershipEffect:'NONE',qualificationEffect:'ACTIVE_ENTITLEMENT',activeDurationUnit:'MONTH',activeDurationValue:months,recognitionConfigRef:'PO_20261019_REPURCHASE_60',packageConfigHash:'a'.repeat(64),purchasedAt:paidAt}});
  const run=()=>db.$transaction(tx=>preparePackageMonthlySchedule(tx,order.orderId,randomUUID()),{isolationLevel:'Serializable'});
  const result=await run();expect(result.created).toBe(true);expect((await run()).created).toBe(false);
  expect(result.subscription.status).toBe('PENDING');
  const rows=result.subscription.schedules.sort((a,b)=>a.installmentNo-b.installmentNo);
  expect(rows).toHaveLength(months);expect(rows[0].dueAt).toEqual(paidAt);expect(rows[1].dueAt.toISOString()).toBe('2040-12-31T16:00:00.000Z');
  expect(rows.every(row=>row.recognizedAmount.eq(2000)&&row.rpvAmount.eq(1200))).toBe(true);
  expect(rows.reduce((sum,row)=>sum.add(row.recognizedAmount),new Prisma.Decimal(0)).toString()).toBe(price);
  expect(await db.pvLedger.count({where:{qualificationId:q.qualificationId}})).toBe(0);
  expect(await db.subscription.count({where:{orderId:order.orderId}})).toBe(1);
  expect(await db.auditEvent.count({where:{entityId:result.subscription.subscriptionId,action:'PACKAGE_MONTHLY_SCHEDULE_PREPARED'}})).toBe(1);
  const audit=await db.auditEvent.findFirstOrThrow({where:{entityId:result.subscription.subscriptionId,action:'PACKAGE_MONTHLY_SCHEDULE_PREPARED'}});
  expect(audit.afterData).toMatchObject({gpvPerMonth:'1200',rpvPerMonth:'1200',epvPerMonth:'0',volumePolicyReference:'PO_20261019_REPURCHASE_NO_EPV'});
  const product=await db.productReference.create({data:{sku:randomUUID(),displayName:'Refund fixture',currentPrice:3000}});
  const line=await db.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:boxes,unitPrice:3000,lineAmount:price,gpvRateSnapshot:'0.6',gpvAmountSnapshot:0,ruleProfileSnapshot:{packageSelection:true}}});
  // Simulate an already posted first month. Refund preparation must preserve
  // its immutable amount and leave the subsequent ledger replay outstanding.
  await db.monthlyRecognitionSchedule.update({where:{recognitionId:rows[0].recognitionId},data:{status:'RECOGNIZED',recognizedAt:paidAt}});
  const createReturn=(quantity:number,amount:number)=>db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date('2042-01-01T00:00:00Z'),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:line.orderLineId,quantity,returnAmount:amount,gpvReversalAmount:0}}}});
  const applyReturn=(id:string)=>db.$transaction(tx=>preparePackageMonthlyReturn(tx,id),{isolationLevel:'Serializable'});
  const partial=await createReturn(1,3000);
  expect((await applyReturn(partial.returnCaseId)).created).toBe(true);
  expect((await applyReturn(partial.returnCaseId)).created).toBe(false);
  const afterPartial=await db.monthlyRecognitionSchedule.findMany({where:{subscriptionId:result.subscription.subscriptionId},orderBy:{installmentNo:'asc'}});
  expect(afterPartial[0].recognizedAmount.toString()).toBe('2000');
  const remainingRatio=new Prisma.Decimal(boxes-1).div(boxes);
  // Every pending installment is already overdue at the refund date.
  expect(afterPartial.slice(1).every(row=>row.recognizedAmount.eq(new Prisma.Decimal(2000).mul(remainingRatio))&&row.rpvAmount.eq(new Prisma.Decimal(1200).mul(remainingRatio)))).toBe(true);
  const full=await createReturn(boxes-1,(boxes-1)*3000);
  await applyReturn(full.returnCaseId);
  const afterFull=await db.monthlyRecognitionSchedule.findMany({where:{subscriptionId:result.subscription.subscriptionId},orderBy:{installmentNo:'asc'}});
  expect(afterFull[0].status).toBe('RECOGNIZED');expect(afterFull[0].recognizedAmount.toString()).toBe('2000');
  expect(afterFull.slice(1).every(row=>row.status==='CANCELLED'&&row.recognizedAmount.eq(0)&&row.rpvAmount.eq(0))).toBe(true);
  expect((await db.subscription.findUniqueOrThrow({where:{subscriptionId:result.subscription.subscriptionId}})).status).toBe('CANCELLED');
  expect((await db.subscriptionCancellation.aggregate({where:{subscriptionId:result.subscription.subscriptionId},_sum:{refundAmount:true}}))._sum.refundAmount!.toString()).toBe(price);
  expect(await db.outboxEvent.count({where:{aggregateId:result.subscription.subscriptionId,eventType:'PACKAGE_MONTHLY_RETURN_REQUIRED'}})).toBe(2);
  // Excess returns fail before adding cancellation or outbox records.
  const excess=await createReturn(1,3000);
  await expect(applyReturn(excess.returnCaseId)).rejects.toThrow('PACKAGE_RETURN_QUANTITY_INVALID');
  expect(await db.subscriptionCancellation.count({where:{subscriptionId:result.subscription.subscriptionId}})).toBe(2);
 }));
});
