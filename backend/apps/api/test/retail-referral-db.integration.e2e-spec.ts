import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {processRetailReferralPayment} from '../../worker/src/main';

const ROLLBACK='RETAIL_REFERRAL_TEST_ROLLBACK';
const url=process.env.RETAIL_REFERRAL_TEST_DATABASE_URL??process.env.DATABASE_URL;
const describeDb=url?.includes('/ucell')?describe:describe.skip;
const d=(value:string|number)=>new Prisma.Decimal(value);

describeDb('Retail Referral rollback integration harness',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url:url!}}});});
 afterAll(()=>db?.$disconnect());

 it('recognizes one active referrer award from the immutable line snapshot and is idempotent',async()=>{
  const marker=`RETAIL_REFERRAL_ROLLBACK_${Date.now()}`;
  await expect(db.$transaction(async tx=>{
   const paidAt=new Date('2044-01-15T04:00:00.000Z');
   const effectiveFrom=new Date('2040-01-01T00:00:00.000Z');
   const rule=`TEST_RETAIL_REFERRAL_${randomUUID()}`;
   await tx.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode:'award.pending.days',scopeKey:'*',valueJson:'45',effectiveFrom}});

   const referrerPerson=await tx.person.create({data:{legalName:`${marker}_REFERRER`,status:'EFFECTIVE'}});
   const purchaser=await tx.person.create({data:{legalName:`${marker}_PURCHASER`,status:'EFFECTIVE'}});
   const referrer=await tx.qualification.create({data:{currentHolderPersonId:referrerPerson.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});
   await tx.qualificationPlanHistory.create({data:{qualificationId:referrer.qualificationId,planCode:'STARTER',effectiveFrom,sourceType:'RETAIL_REFERRAL_TEST'}});
   await tx.qualificationStatusHistory.create({data:{qualificationId:referrer.qualificationId,status:'EFFECTIVE',effectiveFrom,sourceType:'RETAIL_REFERRAL_TEST'}});
   await tx.activePeriod.create({data:{qualificationId:referrer.qualificationId,activeFrom:effectiveFrom,activeTo:new Date('2045-01-01T00:00:00.000Z'),sourceType:'RETAIL_REFERRAL_TEST',ruleVersionCode:rule}});

   const product=await tx.productReference.create({data:{sku:`${marker}_SKU`,displayName:'Synthetic retail referral product',currentPrice:d(100),currency:'TWD'}});
   const profile=await tx.productRuleProfile.create({data:{productId:product.productId,effectiveFrom,gpvRate:d(0),ruleVersionCode:rule,retailReferralEnabled:true,retailReferralCalculationType:'PERCENTAGE',retailReferralRate:d('0.1'),retailReferralBaseType:'NET_PAID_ITEM_AMOUNT'}});
   const order=await tx.order.create({data:{purchaserPersonId:purchaser.personId,purpose:'RETAIL',status:'PAID',grossAmount:d(100),netAmount:d(100),ruleVersionCode:rule,parameterSnapshotHash:'retail-referral-test-snapshot',paidAt}});
   const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:d(1),unitPrice:d(100),lineAmount:d(100),gpvRateSnapshot:d(0),gpvAmountSnapshot:d(0),ruleProfileSnapshot:{profileId:profile.productRuleProfileId,ruleVersionCode:rule}}});
   await tx.retailReferralOrderLineSnapshot.create({data:{orderLineId:line.orderLineId,orderId:order.orderId,referrerQualificationId:referrer.qualificationId,retailReferralEnabled:true,calculationType:'PERCENTAGE',rate:d('0.1'),baseType:'NET_PAID_ITEM_AMOUNT',netPaidItemAmount:d(100),productRuleProfileId:profile.productRuleProfileId,productRuleVersion:rule,parameterSnapshotHash:'retail-referral-test-snapshot',attributionEvidence:{kind:'SYNTHETIC_TEST'}}});
   const event=await tx.outboxEvent.create({data:{eventType:'WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED',aggregateType:'ORDER',aggregateId:order.orderId,payload:{orderId:order.orderId},correlationId:randomUUID()}});
   const lease={outboxEventId:event.outboxEventId} as any;
   const deps={withOutboxLease:async (_db:any,_lease:any,work:any)=>work(tx)};
   await processRetailReferralPayment(db as any,lease,deps as any);
   await processRetailReferralPayment(db as any,lease,deps as any);

   const awards=await tx.bonusAward.findMany({where:{awardType:'RETAIL_REFERRAL',recipientQualificationId:referrer.qualificationId,sourceEventId:line.orderLineId},include:{lifecycleEvents:true}});
   expect(awards).toHaveLength(1);
   expect(awards[0]).toMatchObject({theoryAmount:d(10),payableAmount:d(10),activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:rule});
   expect(awards[0].pendingUntil).toEqual(new Date('2044-02-29T04:00:00.000Z'));
   expect(awards[0].lifecycleEvents.map(row=>row.status).sort()).toEqual(['CALCULATED','PENDING_45D']);
   expect(await tx.pvLedger.count({where:{qualificationId:referrer.qualificationId}})).toBe(0);
   expect(await tx.binaryPlacement.count({where:{childQualificationId:referrer.qualificationId}})).toBe(0);
   expect(await tx.outboxEvent.findUniqueOrThrow({where:{outboxEventId:event.outboxEventId}})).toMatchObject({processStatus:'PROCESSED'});
   throw new Error(ROLLBACK);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(ROLLBACK);
  expect(await db.person.count({where:{legalName:{startsWith:marker}}})).toBe(0);
 },40000);
});
