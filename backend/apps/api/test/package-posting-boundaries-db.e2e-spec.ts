import {PrismaClient, Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {captureParameters, recognizeQualificationPackage, processHistoricalReturn, processQualificationPackageEvent, claimOutboxLease} from '@ucell/database';
import {PackageConfigService} from '../src/modules/package-config/package-config.service';
import {OrderService} from '../src/modules/order/order.service';
import {ReturnService} from '../src/modules/return/return.service';
import {resolvePackageParameters} from '../src/modules/order/package-parameters';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {AuditService} from '../src/common/audit/audit.service';
import {OutboxService} from '../src/common/outbox/outbox.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('package Core parameter and return posting boundaries',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db.$disconnect());
 it('recognizes at placement across months without consumption and reverses a per-box partial return',async()=>{
  const at=new Date(Date.now()-60000),token=randomUUID();
  const policy={gpvRate:'0.6',rpvRate:'0.6',epvRate:'0.6',qualificationPackage:{gpv:true,rpv:false,epv:false,active:'PAYMENT_CALENDAR_MONTH_ASIA_TAIPEI'}};
  await db.runtimeRuleParameter.create({data:{ruleVersionCode:'R1.0B',parameterCode:'OWNER_VOLUME_POLICY_20261019',scopeKey:'*',valueJson:policy,effectiveFrom:at}});
  const person=await db.person.create({data:{legalName:'ISOLATED PACKAGE BOUNDARY',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}});
  const product=await db.productReference.create({data:{sku:'PB-'+token,displayName:'Isolated package product',currentPrice:'4800'}});
  const rule=await db.productRuleProfile.create({data:{productId:product.productId,effectiveFrom:at,gpvRate:'0.6',ruleVersionCode:'R1.0B'}});
  const packages=new PackageConfigService(db as any),profile=await db.packageProfile.findUniqueOrThrow({where:{stableCode:'STARTER'}});
  const version=await packages.addVersion(profile.packageProfileId,{displayName:'Isolated starter',currency:'TWD',priceAmount:'14400',selectableProductQuantity:3,membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,recognitionConfigRef:'PO_20261019_QUALIFICATION_GPV_ONLY'},'fixture-author');
  await packages.setProducts(version.packageProfileVersionId,[{productRuleProfileId:rule.productRuleProfileId,maxQty:3}]);
  await packages.approve(version.packageProfileVersionId,'ISOLATED_TEST','fixture-approver');
  await packages.activate(version.packageProfileVersionId);
  const idempotency=new IdempotencyService(db as any),audit=new AuditService(),outbox=new OutboxService();
  const orders=new OrderService(db as any,idempotency,audit,outbox,packages);
  const input={packageVersionId:version.packageProfileVersionId,selections:[{productRuleProfileId:rule.productRuleProfileId,quantity:3}]};
  const key=randomUUID(),request=randomUUID();
  const order=(await orders.createMember(input,key,request,person.personId)).value;
  expect((await orders.createMember(input,key,request,person.personId)).value.orderId).toBe(order.orderId);
  expect(order.ruleVersionCode).toBe('R1.0B');
  const snapshot=await db.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:order.orderId}});
  expect(snapshot.recognitionConfigRef).toBe('PO_20261019_QUALIFICATION_GPV_ONLY');
  expect(order.parameterSnapshotHash).not.toBe(snapshot.packageConfigHash);
  const parameters=await captureParameters(db as any,order.confirmedAt!,'R1.0B');
  expect(order.parameterSnapshotHash).toBe(parameters.hash);
  await orders.confirmPayment(order.orderId,{amount:'14400',paymentMethod:'TEST_ONLY',referenceNo:token,occurredAt:new Date().toISOString()},randomUUID(),request);
  const before={returns:await db.returnCase.count(),events:await db.outboxEvent.count(),ledger:await db.pvLedger.count()};
  const returns=new ReturnService(db as any,idempotency,audit,outbox);
  for(const quantity of ['1','3']){
   await expect(returns.post(order.orderId,{lines:[{orderLineId:order.lines[0].orderLineId,quantity}],reasonCode:'ISOLATED_TEST',occurredAt:new Date().toISOString()},randomUUID(),request)).rejects.toMatchObject({response:{code:'PACKAGE_ORIGINAL_RECOGNITION_PENDING'}});
  }
  expect({returns:await db.returnCase.count(),events:await db.outboxEvent.count(),ledger:await db.pvLedger.count()}).toEqual(before);
  expect((await db.order.findUniqueOrThrow({where:{orderId:order.orderId}})).status).toBe('PAID');
  expect(await db.returnLine.count({where:{orderLineId:order.lines[0].orderLineId}})).toBe(0);
  const qid=order.qualificationId!;
  const run=()=>db.$transaction(tx=>recognizeQualificationPackage(tx,order.orderId,request),{isolationLevel:'Serializable'});
  expect(await run()).toMatchObject({status:'AWAITING_PLACEMENT',created:0});
  const paymentEvent=await db.outboxEvent.findFirstOrThrow({where:{eventType:'PACKAGE_PAYMENT_CONFIRMED',aggregateId:order.orderId}});
  const paymentLease=await claimOutboxLease(db,paymentEvent);
  await processQualificationPackageEvent(db,paymentLease!);
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:paymentEvent.outboxEventId}})).processStatus).toBe('PROCESSED');

  expect(await db.pvLedger.count({where:{sourceId:order.orderId}})).toBe(0);
  expect(await db.qualificationActiveEntitlementEvidence.count({where:{qualificationId:qid}})).toBe(1);
  const paidMonth=new Date(Date.now()+8*3600000);
  const placedAt=new Date(Date.UTC(paidMonth.getUTCFullYear(),paidMonth.getUTCMonth()+1,2)-8*3600000);
  const parent=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE'}});
  await db.qualificationPlanHistory.create({data:{qualificationId:parent.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'TEST'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:parent.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'TEST'}});
  await db.activePeriod.create({data:{qualificationId:parent.qualificationId,activeFrom:at,sourceType:'TEST',ruleVersionCode:'R1.0B'}});
  await db.sponsorRelationship.create({data:{childQualificationId:qid,sponsorQualificationId:parent.qualificationId,sponsorSequenceNo:1,effectiveFrom:placedAt}});
  await db.binaryPlacement.create({data:{childQualificationId:qid,parentQualificationId:parent.qualificationId,side:'LEFT',effectiveFrom:placedAt}});

  await db.qualificationStatusHistory.updateMany({where:{qualificationId:qid,effectiveTo:null},data:{effectiveTo:placedAt}});
  await db.qualificationStatusHistory.create({data:{qualificationId:qid,status:'EFFECTIVE',effectiveFrom:placedAt,sourceType:'TEST_PLACEMENT'}});
  await db.qualificationPlanHistory.create({data:{qualificationId:qid,planCode:'STARTER',effectiveFrom:placedAt,sourceType:'TEST_PLACEMENT'}});
  await db.qualificationSetup.update({where:{qualificationId:qid},data:{setupStatus:'PLACED',placedAt}});
  await db.placementEvidence.create({data:{qualificationId:qid,sponsorQualificationId:parent.qualificationId,binaryParentQualificationId:parent.qualificationId,side:'LEFT',placedByType:'ADMIN_OVERRIDE',placedAt,policyVersion:'TEST',previousStatus:'BALL_SETUP_PENDING',correlationId:request,evidenceHash:'test'}});
  expect((await db.qualificationActiveEntitlementEvidence.findFirstOrThrow({where:{qualificationId:qid}})).periodEnd.getTime()).toBeLessThan(placedAt.getTime());
  expect(await run()).toMatchObject({status:'RECOGNIZED',created:1});
  expect(await run()).toMatchObject({status:'RECOGNIZED',created:0});
  const placedEvent=await db.outboxEvent.create({data:{eventType:'QUALIFICATION_PLACED',aggregateType:'Qualification',aggregateId:qid,correlationId:request,payload:{qualificationId:qid}}});
  await processQualificationPackageEvent(db,(await claimOutboxLease(db,placedEvent))!);
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:placedEvent.outboxEventId}})).processStatus).toBe('PROCESSED');

  const ledger=await db.pvLedger.findMany({where:{sourceId:order.orderId}});
  expect(ledger.map(v=>[v.pvType,v.amount.toString(),v.occurredAt.toISOString()])).toEqual([['GPV','8640',placedAt.toISOString()]]);
  expect((await db.binaryVolumeLedger.findMany({where:{sourceQualificationId:qid}})).map(v=>v.amount.toString())).toEqual(['8640']);
  expect(await db.consumptionRecognitionEvent.count({where:{sourceId:order.orderId}})).toBe(0);
  expect(await db.qualificationMonthAccumulatorEvidence.count({where:{qualificationId:qid}})).toBe(0);
  expect(await db.activePeriod.count({where:{qualificationId:qid,sourceType:'QUALIFICATION_PACKAGE'}})).toBe(1);
  const returnedAt=new Date(placedAt.getTime()+1000).toISOString(),returnKey=randomUUID();
  const returnInput={lines:[{orderLineId:order.lines[0].orderLineId,quantity:'1'}],reasonCode:'TEST',occurredAt:returnedAt};
  const returned=(await returns.post(order.orderId,returnInput,returnKey,request)).value!;
  expect(returned.lines[0].returnAmount.toString()).toBe('4800');
  expect(returned.lines[0].gpvReversalAmount.toString()).toBe('2880');
  expect((await returns.post(order.orderId,returnInput,returnKey,request)).value!.returnCaseId).toBe(returned.returnCaseId);
  await db.$transaction(tx=>processHistoricalReturn(tx,returned.returnCaseId),{isolationLevel:'Serializable'});
  const reversal=await db.pvLedger.findFirstOrThrow({where:{sourceId:returned.returnCaseId,eventType:'GPV_REVERSAL'}});
  expect(reversal.amount.toString()).toBe('-2880');expect(reversal.reversalOfEventId).toBe(ledger[0].eventId);
  await expect(returns.post(order.orderId,{...returnInput,lines:[{orderLineId:order.lines[0].orderLineId,quantity:'3'}]},randomUUID(),request)).rejects.toBeDefined();
  const finalReturn=(await returns.post(order.orderId,{...returnInput,lines:[{orderLineId:order.lines[0].orderLineId,quantity:'2'}]},randomUUID(),request)).value!;
  await db.$transaction(tx=>processHistoricalReturn(tx,finalReturn.returnCaseId),{isolationLevel:'Serializable'});
  await db.$transaction(tx=>processHistoricalReturn(tx,finalReturn.returnCaseId),{isolationLevel:'Serializable'});
  expect((await db.order.findUniqueOrThrow({where:{orderId:order.orderId}})).status).toBe('RETURNED');
  const reversals=await db.pvLedger.findMany({where:{reversalOfEventId:ledger[0].eventId}});
  expect(reversals).toHaveLength(2);
  expect(reversals.reduce((total,v)=>total.add(v.amount),new Prisma.Decimal(0)).toString()).toBe('-8640');


 });
 it('rejects mixed Core versions and missing historical policy without substituting current configuration',async()=>{
  const version={recognitionConfigRef:'PO_20261019_QUALIFICATION_GPV_ONLY',configHash:'a'.repeat(64)};
  await expect(resolvePackageParameters(db as any,new Date(),version,['R1.0B','OTHER'])).rejects.toMatchObject({response:{code:'PACKAGE_CORE_RULE_MISMATCH'}});
  await expect(resolvePackageParameters(db as any,new Date('2000-01-01'),version,['R1.0B'])).rejects.toMatchObject({response:{code:'PACKAGE_POLICY_CONFIGURATION_PENDING'}});
  expect(await resolvePackageParameters(db as any,new Date(),{recognitionConfigRef:'LEGACY',configHash:'old'},[])).toEqual({ruleVersionCode:'LEGACY',parameterSnapshotHash:'old'});
 });
});
