import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {processRetailReferralPayment,processRetailReferralReturn} from '../../worker/src/main';

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
 it('writes one append-only pending recovery for a partial return and preserves the original award',async()=>{
  const marker=`RETAIL_REFERRAL_RETURN_${Date.now()}`;
  await expect(db.$transaction(async tx=>{
   const at=new Date('2044-03-01T04:00:00.000Z');
   const rule=`TEST_RETAIL_RETURN_${randomUUID()}`;
   const owner=await tx.person.create({data:{legalName:`${marker}_OWNER`,status:'EFFECTIVE'}});
   const purchaser=await tx.person.create({data:{legalName:`${marker}_PURCHASER`,status:'EFFECTIVE'}});
   const referrer=await tx.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
   const product=await tx.productReference.create({data:{sku:`${marker}_SKU`,displayName:'Synthetic return product',currentPrice:d(100)}});
   const profile=await tx.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:at,gpvRate:d(0),ruleVersionCode:rule}});
   const order=await tx.order.create({data:{purchaserPersonId:purchaser.personId,purpose:'RETAIL',status:'PAID',grossAmount:d(100),netAmount:d(100),ruleVersionCode:rule,paidAt:at}});
   const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:d(1),unitPrice:d(100),lineAmount:d(100),gpvRateSnapshot:d(0),gpvAmountSnapshot:d(0),ruleProfileSnapshot:{profileId:profile.productRuleProfileId}}});
   await tx.retailReferralOrderLineSnapshot.create({data:{orderLineId:line.orderLineId,orderId:order.orderId,referrerQualificationId:referrer.qualificationId,retailReferralEnabled:true,calculationType:'PERCENTAGE',rate:d('.1'),baseType:'NET_PAID_ITEM_AMOUNT',netPaidItemAmount:d(100),productRuleProfileId:profile.productRuleProfileId,productRuleVersion:rule,attributionEvidence:{kind:'SYNTHETIC_TEST'}}});
   const award=await tx.bonusAward.create({data:{awardType:'RETAIL_REFERRAL',recipientQualificationId:referrer.qualificationId,sourceEventId:line.orderLineId,theoryAmount:d(10),payableAmount:d(10),kFactor:d(1),activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:rule,occurredAt:at,pendingUntil:new Date('2044-04-15T04:00:00.000Z'),calculationDetail:{kind:'SYNTHETIC_TEST'}}});
   await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:at}});
   const returnCase=await tx.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'SYNTHETIC_PARTIAL_RETURN',occurredAt:new Date('2044-03-02T04:00:00.000Z'),postedAt:new Date('2044-03-02T04:00:00.000Z'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:line.orderLineId,quantity:d('.5'),returnAmount:d(40),gpvReversalAmount:d(0)}}}});
   const event=await tx.outboxEvent.create({data:{eventType:'RETURN_CONFIRMED',aggregateType:'RETURN',aggregateId:returnCase.returnCaseId,payload:{returnCaseId:returnCase.returnCaseId,qualificationId:null},correlationId:randomUUID()}});
   const deps={withOutboxLease:async (_db:any,_lease:any,work:any)=>work(tx)};
   await processRetailReferralReturn(db as any,{outboxEventId:event.outboxEventId} as any,deps as any);
   await processRetailReferralReturn(db as any,{outboxEventId:event.outboxEventId} as any,deps as any);
   const recovered=await tx.bonusRecoveryEvent.findMany({where:{bonusAwardId:award.bonusAwardId,returnCaseId:returnCase.returnCaseId}});
   expect(recovered).toHaveLength(1);
   expect(recovered[0]).toMatchObject({recoveryAmount:d(4),outstandingAmount:d(4),status:'OFFSETTING',reasonCode:'RETAIL_RETURN_PENDING_OFFSET'});
   expect(await tx.bonusAward.findUniqueOrThrow({where:{bonusAwardId:award.bonusAwardId}})).toMatchObject({theoryAmount:d(10),payableAmount:d(10)});
   expect(await tx.bonusAwardLifecycleEvent.count({where:{bonusAwardId:award.bonusAwardId,status:'REVERSED'}})).toBe(0);
   await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:award.bonusAwardId,status:'PAID',occurredAt:new Date('2044-03-02T12:00:00.000Z')}});
   const secondReturn=await tx.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'SYNTHETIC_SECOND_PARTIAL_RETURN',occurredAt:new Date('2044-03-03T04:00:00.000Z'),postedAt:new Date('2044-03-03T04:00:00.000Z'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:line.orderLineId,quantity:d('.5'),returnAmount:d(30),gpvReversalAmount:d(0)}}}});
   const secondEvent=await tx.outboxEvent.create({data:{eventType:'RETURN_CONFIRMED',aggregateType:'RETURN',aggregateId:secondReturn.returnCaseId,payload:{returnCaseId:secondReturn.returnCaseId,qualificationId:null},correlationId:randomUUID()}});
   await processRetailReferralReturn(db as any,{outboxEventId:secondEvent.outboxEventId} as any,deps as any);
   const thirdReturn=await tx.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'SYNTHETIC_THIRD_PARTIAL_RETURN',occurredAt:new Date('2044-03-04T04:00:00.000Z'),postedAt:new Date('2044-03-04T04:00:00.000Z'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:line.orderLineId,quantity:d('.5'),returnAmount:d(30),gpvReversalAmount:d(0)}}}});
   const thirdEvent=await tx.outboxEvent.create({data:{eventType:'RETURN_CONFIRMED',aggregateType:'RETURN',aggregateId:thirdReturn.returnCaseId,payload:{returnCaseId:thirdReturn.returnCaseId,qualificationId:null},correlationId:randomUUID()}});
   await processRetailReferralReturn(db as any,{outboxEventId:thirdEvent.outboxEventId} as any,deps as any);
   const cumulative=await tx.bonusRecoveryEvent.findMany({where:{bonusAwardId:award.bonusAwardId},orderBy:{occurredAt:'asc'}});
   expect(cumulative.map(row=>row.recoveryAmount)).toEqual([d(4),d(3),d(3)]);
   expect(cumulative.map(row=>row.status)).toEqual(['OFFSETTING','OPEN','OPEN']);
   expect(await tx.bonusAwardLifecycleEvent.count({where:{bonusAwardId:award.bonusAwardId,status:'CLAWBACK'}})).toBe(1);
   expect(await tx.bonusAwardLifecycleEvent.count({where:{bonusAwardId:award.bonusAwardId,status:'REVERSED'}})).toBe(0);
   throw new Error(ROLLBACK);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(ROLLBACK);
  expect(await db.person.count({where:{legalName:{startsWith:marker}}})).toBe(0);
 },40000);
 it('reverses a single full pending return without creating a recovery row',async()=>{
  const marker=`RETAIL_REFERRAL_FULL_RETURN_${Date.now()}`;
  await expect(db.$transaction(async tx=>{
   const at=new Date('2044-04-01T04:00:00.000Z'),rule=`TEST_RETAIL_FULL_RETURN_${randomUUID()}`;
   const owner=await tx.person.create({data:{legalName:`${marker}_OWNER`,status:'EFFECTIVE'}}),purchaser=await tx.person.create({data:{legalName:`${marker}_PURCHASER`,status:'EFFECTIVE'}});
   const referrer=await tx.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
   const product=await tx.productReference.create({data:{sku:`${marker}_SKU`,displayName:'Synthetic full return product',currentPrice:d(100)}});
   const profile=await tx.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:at,gpvRate:d(0),ruleVersionCode:rule}});
   const order=await tx.order.create({data:{purchaserPersonId:purchaser.personId,purpose:'RETAIL',status:'PAID',grossAmount:d(100),netAmount:d(100),ruleVersionCode:rule,paidAt:at}});
   const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:d(1),unitPrice:d(100),lineAmount:d(100),gpvRateSnapshot:d(0),gpvAmountSnapshot:d(0),ruleProfileSnapshot:{profileId:profile.productRuleProfileId}}});
   await tx.retailReferralOrderLineSnapshot.create({data:{orderLineId:line.orderLineId,orderId:order.orderId,referrerQualificationId:referrer.qualificationId,retailReferralEnabled:true,calculationType:'PERCENTAGE',rate:d('.1'),baseType:'NET_PAID_ITEM_AMOUNT',netPaidItemAmount:d(100),productRuleProfileId:profile.productRuleProfileId,productRuleVersion:rule,attributionEvidence:{kind:'SYNTHETIC_TEST'}}});
   const award=await tx.bonusAward.create({data:{awardType:'RETAIL_REFERRAL',recipientQualificationId:referrer.qualificationId,sourceEventId:line.orderLineId,theoryAmount:d(10),payableAmount:d(10),kFactor:d(1),activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:rule,occurredAt:at,pendingUntil:new Date('2044-05-16T04:00:00.000Z'),calculationDetail:{kind:'SYNTHETIC_TEST'}}});
   await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:at}});
   const returnCase=await tx.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'SYNTHETIC_FULL_RETURN',occurredAt:new Date('2044-04-02T04:00:00.000Z'),postedAt:new Date('2044-04-02T04:00:00.000Z'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:line.orderLineId,quantity:d(1),returnAmount:d(100),gpvReversalAmount:d(0)}}}});
   const event=await tx.outboxEvent.create({data:{eventType:'RETURN_CONFIRMED',aggregateType:'RETURN',aggregateId:returnCase.returnCaseId,payload:{returnCaseId:returnCase.returnCaseId,qualificationId:null},correlationId:randomUUID()}});
   const deps={withOutboxLease:async (_db:any,_lease:any,work:any)=>work(tx)};
   await processRetailReferralReturn(db as any,{outboxEventId:event.outboxEventId} as any,deps as any);
   await processRetailReferralReturn(db as any,{outboxEventId:event.outboxEventId} as any,deps as any);
   expect(await tx.bonusRecoveryEvent.count({where:{bonusAwardId:award.bonusAwardId}})).toBe(0);
   expect(await tx.bonusAwardLifecycleEvent.count({where:{bonusAwardId:award.bonusAwardId,status:'REVERSED',reasonCode:'RETAIL_RETURN_FULL_OFFSET'}})).toBe(1);
   throw new Error(ROLLBACK);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(ROLLBACK);
  expect(await db.person.count({where:{legalName:{startsWith:marker}}})).toBe(0);
 },40000);
 it('records an inactive referrer as zero-payable without creating volume or organization effects',async()=>{
  const marker=`RETAIL_REFERRAL_INACTIVE_${Date.now()}`;
  await expect(db.$transaction(async tx=>{
   const paidAt=new Date('2044-05-01T04:00:00.000Z'),effectiveFrom=new Date('2040-01-01T00:00:00.000Z'),rule=`TEST_RETAIL_INACTIVE_${randomUUID()}`;
   await tx.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode:'award.pending.days',scopeKey:'*',valueJson:'45',effectiveFrom}});
   const owner=await tx.person.create({data:{legalName:`${marker}_OWNER`,status:'EFFECTIVE'}}),purchaser=await tx.person.create({data:{legalName:`${marker}_PURCHASER`,status:'EFFECTIVE'}});
   const referrer=await tx.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});
   await tx.qualificationPlanHistory.create({data:{qualificationId:referrer.qualificationId,planCode:'STARTER',effectiveFrom,sourceType:'RETAIL_REFERRAL_TEST'}});
   const product=await tx.productReference.create({data:{sku:`${marker}_SKU`,displayName:'Synthetic inactive retail product',currentPrice:d(100)}});
   const profile=await tx.productRuleProfile.create({data:{productId:product.productId,effectiveFrom,gpvRate:d(0),ruleVersionCode:rule}});
   const order=await tx.order.create({data:{purchaserPersonId:purchaser.personId,purpose:'RETAIL',status:'PAID',grossAmount:d(100),netAmount:d(100),ruleVersionCode:rule,paidAt}});
   const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:d(1),unitPrice:d(100),lineAmount:d(100),gpvRateSnapshot:d(0),gpvAmountSnapshot:d(0),ruleProfileSnapshot:{profileId:profile.productRuleProfileId}}});
   await tx.retailReferralOrderLineSnapshot.create({data:{orderLineId:line.orderLineId,orderId:order.orderId,referrerQualificationId:referrer.qualificationId,retailReferralEnabled:true,calculationType:'PERCENTAGE',rate:d('.1'),baseType:'NET_PAID_ITEM_AMOUNT',netPaidItemAmount:d(100),productRuleProfileId:profile.productRuleProfileId,productRuleVersion:rule,attributionEvidence:{kind:'SYNTHETIC_TEST'}}});
   const event=await tx.outboxEvent.create({data:{eventType:'WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED',aggregateType:'ORDER',aggregateId:order.orderId,payload:{orderId:order.orderId},correlationId:randomUUID()}});
   await processRetailReferralPayment(db as any,{outboxEventId:event.outboxEventId} as any,{withOutboxLease:async (_db:any,_lease:any,work:any)=>work(tx)} as any);
   const award=await tx.bonusAward.findFirstOrThrow({where:{awardType:'RETAIL_REFERRAL',sourceEventId:line.orderLineId}});
   expect(award).toMatchObject({theoryAmount:d(10),payableAmount:d(0),activeSnapshot:false});
   expect(await tx.pvLedger.count({where:{qualificationId:referrer.qualificationId}})).toBe(0);
   expect(await tx.binaryPlacement.count({where:{childQualificationId:referrer.qualificationId}})).toBe(0);
   throw new Error(ROLLBACK);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000})).rejects.toThrow(ROLLBACK);
  expect(await db.person.count({where:{legalName:{startsWith:marker}}})).toBe(0);
 },40000);
});
