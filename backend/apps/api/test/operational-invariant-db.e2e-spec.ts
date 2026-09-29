import {PrismaClient,Prisma} from '@prisma/client';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
import {randomUUID} from 'node:crypto';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;

describeDb('OPERATIONAL_INVARIANT_REAL_DB',()=>{
  let db:PrismaClient;
  beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
  afterAll(()=>db.$disconnect());

  it('reports a payout total mismatch as a deterministic read-only candidate',async()=>{
    const person=await db.person.create({data:{legalName:'Invariant Recipient'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
    const batch=await db.payoutBatch.create({data:{periodStart:new Date('2026-11-01T00:00:00Z'),periodEnd:new Date('2026-11-30T00:00:00Z'),status:'READY',totalGross:new Prisma.Decimal(100),totalRecovery:new Prisma.Decimal(0),totalNet:new Prisma.Decimal(100)}});
    await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:qualification.qualificationId,grossAmount:new Prisma.Decimal(90),netAmount:new Prisma.Decimal(90),detailJson:{source:'invariant-test'}}});
    const monitor=new AdminOperationsService(db as any,new AuditService());
    const first=await monitor.invariantCandidates();
    const second=await monitor.invariantCandidates();
    expect(first).toEqual(second);
    expect(first).toContainEqual(expect.objectContaining({code:'PAYOUT_BATCH_TOTAL_MISMATCH',severity:'CRITICAL',reference:'PAYOUT:2026-11-01:2026-11-30',detail:{declaredTotalNet:'100',lineNetTotal:'90',status:'READY'}}));
    expect(JSON.stringify(first)).not.toContain(batch.payoutBatchId);
    expect(await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:batch.payoutBatchId}})).toMatchObject({totalNet:new Prisma.Decimal(100),status:'READY'});
  });

  it('reports a BONUS_AWARD payable whose immutable award source is missing without changing payable state',async()=>{
    const person=await db.person.create({data:{legalName:'Missing Award Recipient'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
    const missingAwardId='00000000-0000-0000-0000-000000000777';
    const payable=await db.payableEntry.create({data:{qualificationId:qualification.qualificationId,sourceType:'BONUS_AWARD',sourceId:missingAwardId,awardType:'REFERRAL',grossAmount:new Prisma.Decimal(17),availableAt:new Date(),ruleVersionCode:'R1'}});
    const candidates=await new AdminOperationsService(db as any,new AuditService()).invariantCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({code:'PAYABLE_AWARD_SOURCE_MISSING',severity:'CRITICAL',reference:`QUALIFICATION:${qualification.qualificationNo.toString()}:PAYABLE_AWARD`,detail:expect.objectContaining({sourceType:'BONUS_AWARD',grossAmount:'17'})}));
    expect(JSON.stringify(candidates)).not.toContain(payable.payableEntryId);
    expect(await db.payableEntry.findUniqueOrThrow({where:{payableEntryId:payable.payableEntryId}})).toMatchObject({status:'OPEN',grossAmount:new Prisma.Decimal(17)});
  });

  it('reports overdue recognition as a privacy-safe read-only candidate',async()=>{
    const person=await db.person.create({data:{legalName:'Overdue Recognition Holder'}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
    const plan=await db.subscriptionPlan.create({data:{planCode:`OVERDUE-${Date.now()}`,displayName:'Overdue invariant plan',durationMonths:3,prepaidAmount:new Prisma.Decimal(300),productBoxQty:2,monthlyRecognizedAmount:new Prisma.Decimal(100),monthlyRpv:new Prisma.Decimal(10)}});
    const subscription=await db.subscription.create({data:{qualificationId:qualification.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:new Date('2026-01-01'),endMonth:new Date('2026-03-01'),ruleVersionCode:'R1.0B'}});
    const schedule=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:1,recognitionMonth:new Date('2026-01-01'),recognizedAmount:new Prisma.Decimal(100),rpvAmount:new Prisma.Decimal(10),dueAt:new Date('2026-01-03'),ruleVersionCode:'R1.0B'}});
    const candidates=await new AdminOperationsService(db as any,new AuditService()).invariantCandidates();
    expect(candidates).toContainEqual(expect.objectContaining({code:'OVERDUE_RECOGNITION',severity:'HIGH',reference:`QUALIFICATION:${qualification.qualificationNo.toString()}:RECOGNITION:2026-01-03`,detail:expect.objectContaining({status:'SCHEDULED',installmentNo:1,ruleVersionCode:'R1.0B'})}));
    expect(JSON.stringify(candidates)).not.toContain(schedule.recognitionId);
    expect(await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:schedule.recognitionId}})).toMatchObject({status:'SCHEDULED'});
  });

  async function fulfillmentFixture(){
    const token=randomUUID();
    const purchaser=await db.person.create({data:{legalName:"Invariant purchaser"}});
    const product=await db.productReference.create({data:{sku:`INV-${token}`,displayName:'Invariant product',currentPrice:10}});
    const order=await db.order.create({data:{purchaserPersonId:purchaser.personId,purpose:'RETAIL',status:'CONFIRMED',grossAmount:20,netAmount:20,ruleVersionCode:'R1.0B',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:2,unitPrice:10,lineAmount:20,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}}},include:{lines:true}});
    const fulfillment=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:`INV-${token}`,allocationSnapshotRef:'test',fulfillmentPolicySnapshotRef:'test'}});
    const source=await db.fulfillmentSourceAllocation.create({data:{fulfillmentId:fulfillment.fulfillmentId,orderLineId:order.lines[0].orderLineId,allocatedQuantity:2,skuSnapshot:product.sku}});
    return {product,order,fulfillment,source};
  }
  it('allows incomplete scans before handoff but flags a durable handoff with missing serials, without changing evidence',async()=>{
    const f=await fulfillmentFixture(),monitor=new AdminOperationsService(db as any,new AuditService());
    const own=(rows:any[])=>rows.filter(r=>r.reference.includes(f.fulfillment.fulfillmentKey));
    expect(own(await monitor.invariantCandidates())).toEqual([]);
    const event=await db.outboxEvent.create({data:{eventType:'FULFILLMENT_ERP_HANDOFF_REQUESTED',aggregateType:'FULFILLMENT',aggregateId:f.fulfillment.fulfillmentId,payload:{},correlationId:randomUUID()}});
    const handoff=await db.fulfillmentErpHandoff.create({data:{fulfillmentId:f.fulfillment.fulfillmentId,outboxEventId:event.outboxEventId,providerCode:'TEST',formatVersion:'UCELL_FULFILLMENT_ERP_V1',payloadHash:'a'.repeat(64),payloadSnapshot:{},requestedByActor:'test'}});
    const first=own(await monitor.invariantCandidates()),second=own(await monitor.invariantCandidates());
    expect(first).toEqual(second);
    expect(first).toEqual([expect.objectContaining({code:'FULFILLMENT_HANDOFF_SERIAL_QUANTITY_MISMATCH',detail:{allocatedQuantity:'2',serialCount:0}})]);
    for(const id of [f.source.fulfillmentSourceAllocationId,f.fulfillment.fulfillmentId,f.order.orderId,event.outboxEventId]) expect(JSON.stringify(first)).not.toContain(id);
    expect(await db.fulfillmentErpHandoff.findUniqueOrThrow({where:{fulfillmentId:f.fulfillment.fulfillmentId}})).toEqual(handoff);
    expect(await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:event.outboxEventId}})).toEqual(event);
  });
  it('detects a wrong-product serial, cross-fulfillment binding and excessive scans using business references',async()=>{
    const f=await fulfillmentFixture(),other=await fulfillmentFixture();
    const batch=await db.productSerialBatch.create({data:{productId:other.product.productId,serialPrefix:'E',batchSequence:987,batchCode:randomUUID()}});
    for(let i=1;i<=3;i++){
      const unit=await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialNo:`E987000${i}`,serialSequence:i}});
      await db.fulfillmentSerialAllocation.create({data:{fulfillmentId:other.fulfillment.fulfillmentId,fulfillmentSourceAllocationId:f.source.fulfillmentSourceAllocationId,serializedUnitId:unit.serializedUnitId,scannedByActor:'test',scannedAt:new Date(),correlationId:randomUUID()}});
    }
    const before=await db.fulfillmentSerialAllocation.findMany({where:{fulfillmentSourceAllocationId:f.source.fulfillmentSourceAllocationId}});
    const result=(await new AdminOperationsService(db as any,new AuditService()).invariantCandidates()).filter(r=>r.reference.includes(f.fulfillment.fulfillmentKey));
    expect(result.map(r=>r.code)).toEqual(['FULFILLMENT_SERIAL_QUANTITY_EXCEEDED','FULFILLMENT_SERIAL_SOURCE_MISMATCH']);
    expect(result[1].detail).toMatchObject({mismatchedSerialCount:3});
    expect(await db.fulfillmentSerialAllocation.findMany({where:{fulfillmentSourceAllocationId:f.source.fulfillmentSourceAllocationId}})).toEqual(before);
    expect(JSON.stringify(result)).not.toContain(f.source.fulfillmentSourceAllocationId);
  });
  it('reports source allocations that point to another order or contradict the captured order SKU',async()=>{
    const f=await fulfillmentFixture(),other=await fulfillmentFixture();
    const invalid=await db.fulfillmentSourceAllocation.create({data:{fulfillmentId:f.fulfillment.fulfillmentId,orderLineId:other.order.lines[0].orderLineId,allocatedQuantity:1,skuSnapshot:'WRONG-SNAPSHOT'}});
    const result=(await new AdminOperationsService(db as any,new AuditService()).invariantCandidates()).filter(r=>r.reference.includes(f.fulfillment.fulfillmentKey));
    expect(result).toEqual([expect.objectContaining({code:'FULFILLMENT_SOURCE_MISMATCH',detail:{orderMatches:false,skuMatches:false}})]);
    expect(await db.fulfillmentSourceAllocation.findUniqueOrThrow({where:{fulfillmentSourceAllocationId:invalid.fulfillmentSourceAllocationId}})).toEqual(invalid);
  });
  it('does not flag a correctly bound, fully scanned fulfillment',async()=>{
    const f=await fulfillmentFixture();
    const batch=await db.productSerialBatch.create({data:{productId:f.product.productId,serialPrefix:'E',batchSequence:986,batchCode:randomUUID()}});
    for(let i=1;i<=2;i++){
      const unit=await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialNo:`E986000${i}`,serialSequence:i,status:'ALLOCATED'}});
      await db.fulfillmentSerialAllocation.create({data:{fulfillmentId:f.fulfillment.fulfillmentId,fulfillmentSourceAllocationId:f.source.fulfillmentSourceAllocationId,serializedUnitId:unit.serializedUnitId,scannedByActor:'test',scannedAt:new Date(),correlationId:randomUUID()}});
    }
    const result=(await new AdminOperationsService(db as any,new AuditService()).invariantCandidates()).filter(r=>r.reference.includes(f.fulfillment.fulfillmentKey));
    expect(result).toEqual([]);
  });
});
