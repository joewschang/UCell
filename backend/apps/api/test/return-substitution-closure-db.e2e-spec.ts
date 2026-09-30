import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
import {FulfillmentSerialProvenanceService} from '../src/modules/commerce/fulfillment-serial-provenance.service';
import {SubscriptionCancellationService} from '../src/modules/subscription/subscription-cancellation.service';
import {RpvService} from '../src/modules/rpv/rpv.service';
import {replayRpvCancellation} from '@ucell/database';
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('§36 canonical same-SKU substitution closure',()=>{
 let db:PrismaClient,service:FulfillmentSerialProvenanceService,sequence=965;
 const context=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()});
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new FulfillmentSerialProvenanceService(db as any,new AuditService());});
 afterAll(async()=>db?.$disconnect());
 async function fixture(wrongContents=false,splitSameSku=true,allowSubstitution=true,differentTargetSku=false,owner?:{personId:string}){
  const person=owner??await db.person.create({data:{legalName:'Synthetic serial provenance'}});
  const product=await db.productReference.upsert({where:{sku:'TIP-777'},create:{sku:'TIP-777',displayName:'Synthetic TIP-777',currentPrice:100},update:{}});
  const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date('2026-09-01')}});
  const targetProduct=differentTargetSku?await db.productReference.create({data:{sku:'OTHER-'+randomUUID(),displayName:'Different physical SKU',currentPrice:100}}):product;
  const lineInput=(purpose:string,quantity:number)=>({productId:purpose==='REPURCHASE_PLAN'?targetProduct.productId:product.productId,skuSnapshot:purpose==='REPURCHASE_PLAN'?targetProduct.sku:product.sku,productNameSnapshot:product.displayName,quantity,unitPrice:100,lineAmount:100*quantity,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{returnSerialSubstitutionAllowed:allowSubstitution},linePurpose:purpose,commercialOfferingSnapshot:{version:1,offeringCode:purpose==='QUALIFICATION_PACKAGE'?'STARTER':'QUARTER_REPURCHASE',returnSerialSubstitutionAllowed:allowSubstitution}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,qualificationId:qualification.qualificationId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:splitSameSku?500:200,netAmount:splitSameSku?500:200,ruleVersionCode:'R1.0B',lines:{create:splitSameSku?[lineInput('QUALIFICATION_PACKAGE',3),lineInput('REPURCHASE_PLAN',2)]:lineInput('ADDITIONAL_PURCHASE',2)}},include:{lines:true}});
  const f=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'test',fulfillmentPolicySnapshotRef:'test'}});
  const sources=[];
  for(const line of order.lines)sources.push(await db.$transaction(tx=>new FulfillmentSourceAllocationService(db as any).allocate(tx,{fulfillmentId:f.fulfillmentId,orderLineId:line.orderLineId,quantity:line.quantity.toString()})));
  const source=sources[0];
  const batchNo=sequence++,batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'E',batchSequence:batchNo,batchCode:randomUUID()}});
  const targetBatch=differentTargetSku?await db.productSerialBatch.create({data:{productId:targetProduct.productId,serialPrefix:'D',batchSequence:batchNo,batchCode:randomUUID()}}):batch;
  const serialNos=Array.from({length:splitSameSku?5:2},(_,index)=>`${differentTargetSku&&index>=3?'D':'E'}${batchNo}${String(index+1).padStart(4,'0')}`);
  for(let index=0;index<serialNos.length;index++){
   await db.serializedUnit.create({data:{productSerialBatchId:index>=3?targetBatch.productSerialBatchId:batch.productSerialBatchId,serialSequence:index+1,serialNo:serialNos[index]}});
   await new FulfillmentSerialScanService(db as any,new AuditService()).scan({fulfillmentSourceAllocationId:sources[splitSameSku&&index>=3?1:0].fulfillmentSourceAllocationId,serialNo:serialNos[index],...context()});
  }
  const pack=await new FulfillmentPackVerificationService(db as any,new AuditService()).verify({fulfillmentId:f.fulfillmentId,...context()});
  const connection=await db.providerConnection.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'a'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture',approvalReference:'synthetic'}}},include:{versions:true}});
  const parcel=await db.fulfillmentParcel.create({data:{fulfillmentId:f.fulfillmentId,parcelKey:'P1',contentSnapshotRef:wrongContents?'wrong':pack.evidence.policySnapshotRef,packageSnapshotRef:'synthetic'}});
  const shipment=await db.shipment.create({data:{fulfillmentId:f.fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:pack.evidence.fulfillmentQcEvidenceId,provider:'OTHER',connectionId:connection.connectionKey,providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,carrier:'OTHER',shippingMethod:'HOME_DELIVERY',recipientSnapshotRef:'snapshot://synthetic',providerShipmentRef:randomUUID(),status:'LABEL_CREATED'}});
  const bind=()=>service.bindShipment(f.fulfillmentId,shipment.shipmentId,context());
  const dispatch=async()=>db.$transaction(async tx=>{
   const now=new Date(),correlationId=randomUUID();
   const evidence=await tx.shipmentTrackingEventEvidence.create({data:{shipmentId:shipment.shipmentId,providerConnectionVersionId:shipment.providerConnectionVersionId,providerEventIdentity:randomUUID(),providerShipmentRef:shipment.providerShipmentRef!,rawStatusCode:'TEST_PICKED_UP',normalizedStatus:'PICKED_UP',mappingSnapshotRef:'snapshot://synthetic-mapping',payloadHash:'b'.repeat(64),safeEvidenceRef:'evidence://synthetic',eventTime:now,verifiedAt:now,correlationId}});
   await tx.shipmentStateTransition.create({data:{shipmentId:shipment.shipmentId,shipmentTrackingEventEvidenceId:evidence.shipmentTrackingEventEvidenceId,fromStatus:'LABEL_CREATED',toStatus:'PICKED_UP',businessEffectIdentity:randomUUID(),operationHash:'c'.repeat(64),occurredAt:now,correlationId}});
   await tx.shipment.update({where:{shipmentId:shipment.shipmentId},data:{status:'PICKED_UP'}});
  });
  const acceptedReturn=async(quantity=1,lineIndex=0)=>db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[lineIndex].orderLineId,quantity,returnAmount:100*quantity,gpvReversalAmount:0}}},include:{lines:true}});
  return {f,order,person,qualification,product,source,sources,serialNos,shipment,bind,dispatch,acceptedReturn};
 }
 it('SAME_ORDER_SAME_SKU_RETURN_SUBSTITUTION / ECONOMIC_RECOVERY_CORRECT: STARTER 3 + quarter repurchase 2 preserves provenance and recovers only the accepted plan',async()=>{
  const f=await fixture(),at=new Date('2026-09-01');
  expect(f.order.lines.map(line=>line.quantity.toString())).toEqual(['3','2']);
  expect(f.serialNos).toHaveLength(5);
  const parent=await db.qualification.create({data:{currentHolderPersonId:f.person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
  for(const q of [f.qualification,parent]){
   await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'TEST'}});
   await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'TEST'}});
   await db.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:at,sourceType:'TEST',ruleVersionCode:'R1.0B'}});
  }
  await db.binaryPlacement.create({data:{parentQualificationId:parent.qualificationId,childQualificationId:f.qualification.qualificationId,side:'LEFT',effectiveFrom:at}});
  const plan=await db.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Synthetic quarter 2 boxes',durationMonths:3,prepaidAmount:200,productBoxQty:2,monthlyRecognizedAmount:66.67,monthlyRpv:1}});
  const sub=await db.subscription.create({data:{qualificationId:f.qualification.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,orderId:f.order.orderId,status:'ACTIVE',startMonth:at,endMonth:new Date('2026-11-01'),ruleVersionCode:'R1.0B'}});
  const schedules:Array<{recognitionId:string}>=[];
  for(let i=0;i<3;i++)schedules.push(await db.monthlyRecognitionSchedule.create({data:{subscriptionId:sub.subscriptionId,installmentNo:i+1,recognitionMonth:new Date(Date.UTC(2026,8+i,1)),dueAt:new Date(Date.UTC(2026,8+i,16)),recognizedAmount:i===2?66.66:66.67,rpvAmount:1,ruleVersionCode:'R1.0B'}}));
  await new RpvService(db as any,{} as any).recognize(schedules[0].recognitionId);
  const originalAwards=await db.rpvUplineAwardEvent.findMany({where:{recognitionId:schedules[0].recognitionId}});
  expect(originalAwards.map(row=>row.payableAmount.toString())).toEqual(['100']);
  await f.bind();await f.dispatch();await f.bind();
  const physicalBefore=await db.fulfillmentSerialAllocation.findMany({where:{fulfillmentId:f.f.fulfillmentId},orderBy:{serializedUnitId:'asc'}});
  const sourcesBefore=await db.fulfillmentSourceAllocation.findMany({where:{fulfillmentId:f.f.fulfillmentId},orderBy:{orderLineId:'asc'}});
  const ret=await f.acceptedReturn(2,1),received=await service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,f.serialNos.slice(0,2),context());
  expect(received).toMatchObject({serialCount:2,substitutedCount:2,replayed:false});
  expect(received.results.every(row=>row.economicPurpose==='REPURCHASE_PLAN')).toBe(true);
  const cancellation=await new SubscriptionCancellationService(db as any).cancel(sub.subscriptionId,new Date('2026-09-28'),'FULL_RETURN','200',{sourceReturnCaseId:ret.returnCaseId,idempotencyKey:randomUUID()});
  const action='RPV:'+schedules[0].recognitionId+':'+cancellation.cancellation.subscriptionCancellationId;
  const replay=()=>db.$transaction(tx=>replayRpvCancellation(tx,schedules[0].recognitionId,cancellation.cancellation.subscriptionCancellationId,action,randomUUID()),{timeout:15000});
  await replay();await replay();
  expect((await db.entitlementReplayPosting.findMany({where:{actionKey:action}})).map(row=>row.delta.toString())).toEqual(['-100']);
  expect((await db.pvLedger.findMany({where:{sourceLineId:schedules[0].recognitionId,eventType:'RPV_REVERSAL'}})).map(row=>row.amount.toString())).toEqual(['-1']);
  expect(await db.rpvUplineAwardEvent.findMany({where:{recognitionId:schedules[0].recognitionId}})).toEqual(originalAwards);
  expect(await db.monthlyRecognitionSchedule.count({where:{subscriptionId:sub.subscriptionId,status:'CANCELLED'}})).toBe(2);
  expect(await db.fulfillmentSerialAllocation.findMany({where:{fulfillmentId:f.f.fulfillmentId},orderBy:{serializedUnitId:'asc'}})).toEqual(physicalBefore);
  expect(await db.fulfillmentSourceAllocation.findMany({where:{fulfillmentId:f.f.fulfillmentId},orderBy:{orderLineId:'asc'}})).toEqual(sourcesBefore);
  const receipts=await db.returnSerialReceipt.findMany({where:{returnLineId:ret.lines[0].returnLineId},include:{shipmentBinding:{include:{allocation:{include:{serializedUnit:true,sourceAllocation:true}}}}}});
  expect(receipts).toHaveLength(2);
  expect(receipts.map(row=>row.shipmentBinding.allocation.serializedUnit.serialNo).sort()).toEqual(f.serialNos.slice(0,2).sort());
  for(const row of receipts){expect(row.shipmentBinding.allocation.sourceAllocation.linePurpose).toBe('QUALIFICATION_PACKAGE');expect(row.eligibilityEvidence).toMatchObject({sku:'TIP-777',economicPurpose:'REPURCHASE_PLAN',originalPurpose:'QUALIFICATION_PACKAGE'});}
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,f.serialNos.slice(0,2),context())).resolves.toMatchObject({replayed:true});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(2);
 },30000);
 it('RETURN_SUBSTITUTION_SAME_MEMBER_REQUIRED / SAME_ORDER_REQUIRED rejects another purchaser with identical TIP-777 units',async()=>{
  const f=await fixture(),other=await fixture();await f.dispatch();await f.bind();await other.dispatch();await other.bind();
  const ret=await f.acceptedReturn(2,1);
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,other.serialNos.slice(0,2),context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_SOURCE_MISMATCH'}});
  await expect(service.receiveReturn(other.f.fulfillmentId,ret.returnCaseId,other.serialNos.slice(0,2),context())).rejects.toMatchObject({response:{code:'POSTED_RETURN_REQUIRED'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(0);
 });
 it('RETURN_SUBSTITUTION_CONCURRENT_SINGLE_CONSUMPTION prevents two ReturnCases consuming one substituted unit',async()=>{
  const f=await fixture();await f.dispatch();await f.bind();const a=await f.acceptedReturn(1,1),b=await f.acceptedReturn(1,1);
  const results=await Promise.allSettled([a,b].map(ret=>service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[f.serialNos[0]],context())));
  expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);
  expect((results.find(row=>row.status==='rejected') as PromiseRejectedResult).reason).toMatchObject({response:{code:'SERIAL_ALREADY_RETURNED'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:{in:[a.lines[0].returnLineId,b.lines[0].returnLineId]}}})).toBe(1);
 });

 it('RETURN_SUBSTITUTION_SAME_ORDER_REQUIRED rejects another order even for the same member and SKU',async()=>{
  const f=await fixture(),other=await fixture(false,true,true,false,f.person);await f.dispatch();await f.bind();await other.dispatch();await other.bind();const ret=await f.acceptedReturn(2,1);
  expect(f.order.purchaserPersonId).toBe(other.order.purchaserPersonId);
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,other.serialNos.slice(0,2),context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_SOURCE_MISMATCH'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(0);
 });
 it('RETURN_SUBSTITUTION_SAME_SKU_REQUIRED rejects a different SKU in the same member/order/shipment pool',async()=>{
  const f=await fixture(false,true,true,true);await f.dispatch();await f.bind();const ret=await f.acceptedReturn(2,1);
  expect(f.order.lines[0].skuSnapshot).not.toBe(f.order.lines[1].skuSnapshot);
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,f.serialNos.slice(0,2),context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_SOURCE_MISMATCH'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(0);
 });
});
