import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FulfillmentSourceAllocationService } from '../src/modules/commerce/fulfillment-source-allocation.service';
const url = process.env.PHASE2_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;
describeDb('fulfillment source allocation', () => {
 let db: PrismaClient;
 beforeAll(() => { db = new PrismaClient({ datasources: { db: { url } } }); });
 afterAll(() => db.$disconnect());
 it('preserves order-line offering provenance and fails closed for invalid allocation', async () => {
  const token=randomUUID();
  const purchaser=await db.person.create({data:{legalName:'Fulfillment purchaser '+token,status:'EFFECTIVE'}});
  const product=await db.productReference.create({data:{sku:'FUL-'+token,displayName:'Fulfillment product',currentPrice:new Prisma.Decimal(100)}});
  const order=await db.order.create({data:{purchaserPersonId:purchaser.personId,purpose:'RETAIL',status:'CONFIRMED',grossAmount:new Prisma.Decimal(100),discountAmount:new Prisma.Decimal(0),netAmount:new Prisma.Decimal(100),ruleVersionCode:'R1.0B',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:new Prisma.Decimal(2),unitPrice:new Prisma.Decimal(50),lineAmount:new Prisma.Decimal(100),gpvRateSnapshot:new Prisma.Decimal(0),gpvAmountSnapshot:new Prisma.Decimal(0),ruleProfileSnapshot:{},commercialOfferingSnapshot:{offeringCode:'CORE-DEMO',version:1},linePurpose:'ADDITIONAL_PURCHASE'}}},include:{lines:true}});
  const fulfillment=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:'F-'+token,allocationSnapshotRef:'A-'+token,fulfillmentPolicySnapshotRef:'P-'+token}});
  const service=new FulfillmentSourceAllocationService(db as any);
  const first=await db.$transaction(tx=>service.allocate(tx as any,{fulfillmentId:fulfillment.fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'2'}));
  const replay=await db.$transaction(tx=>service.allocate(tx as any,{fulfillmentId:fulfillment.fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'2'}));
  expect(replay.fulfillmentSourceAllocationId).toBe(first.fulfillmentSourceAllocationId);
  expect(first).toMatchObject({skuSnapshot:product.sku,linePurpose:'ADDITIONAL_PURCHASE',commercialOfferingSnapshot:{offeringCode:'CORE-DEMO',version:1}});
  await expect(db.$transaction(tx=>service.allocate(tx as any,{fulfillmentId:fulfillment.fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'3'}))).rejects.toMatchObject({response:{code:'FULFILLMENT_ALLOCATION_EXCEEDS_ORDER_LINE'}});
 });
});