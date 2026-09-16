import { Prisma, PrismaService, claimOutboxLease } from '@ucell/database';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { OutboxService } from '../src/common/outbox/outbox.service';
import { PersonService } from '../src/modules/person/person.service';
import { OrderService } from '../src/modules/order/order.service';
import { QualificationService } from '../src/modules/qualification/qualification.service';
import { OrganizationService } from '../src/modules/organization/organization.service';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { processSaleConfirmed } from '../../worker/src/main';

// Stateful persistence mocks: service-level evidence, not DB concurrency evidence.
function fixture() {
  const records = new Map<string, any>();
  const identity = (where: any) => JSON.stringify(where.actorScope_idempotencyKey);
  let order: any = { orderId: 'order', qualificationId: 'ball', status: 'CONFIRMED', netAmount: new Prisma.Decimal('2400'), ruleVersionCode: 'TEST_ONLY', parameterSnapshotHash: 'sealed-hash', lines: [] };
  const tx = {
    idempotencyRecord: {
      findUnique: jest.fn(async ({where}: any) => records.get(identity(where)) ?? null),
      create: jest.fn(async ({data}: any) => records.set(identity({actorScope_idempotencyKey: {actorScope: data.actorScope, idempotencyKey: data.idempotencyKey}}), {...data, responseBody: null, statusCode: null})),
      update: jest.fn(async ({where, data}: any) => records.set(identity(where), {...records.get(identity(where)), ...data})),
    },
    person: { create: jest.fn(async ({data}: any) => ({personId: 'person', ...data})) },
    qualification: {findUnique: jest.fn(async (_query: any): Promise<any> => ({qualificationId: 'ball', status: 'EFFECTIVE'}))},
    productReference: {findMany: jest.fn(async (_query: any) => [{productId: 'product', sku: 'TEST_ONLY_SKU', displayName: 'TEST_ONLY Product', currentPrice: new Prisma.Decimal('123.45')}])},
    productRuleProfile: {findFirst: jest.fn(async (_query: any): Promise<any> => ({productRuleProfileId: 'profile', gpvRate: new Prisma.Decimal('.4'), pvRate: new Prisma.Decimal('.2'), rpvEligible: false, epvEligible: true, ruleVersionCode: 'TEST_ONLY', parameterSnapshotHash: 'sealed-hash'}))},
    order: {
      create: jest.fn(async ({data}: any) => ({...data, orderId: 'created-order', lines: data.lines.create})),
      findUnique: jest.fn(async () => order),
      update: jest.fn(async ({data}: any) => { order = {...order, ...data}; return order; }),
    },
    paymentEvent: { create: jest.fn(async ({data}: any) => ({paymentEventId: 'payment', ...data})) },
    pvLedger: { create: jest.fn(), upsert: jest.fn() },
    outboxEvent: { create: jest.fn(async ({data}: any) => ({outboxEventId: 'outbox', ...data})) },
  };
  const prisma = {idempotencyRecord: tx.idempotencyRecord, $transaction: jest.fn(async (work: any, _options: any) => work(tx))};
  const audit = {write: jest.fn(async (_tx: any, _event: any) => undefined)};
  const idempotency = new IdempotencyService(prisma as any);
  return {tx, prisma, audit, person: new PersonService(prisma as any, idempotency, audit as any), orders: new OrderService(prisma as any, idempotency, audit as any, new OutboxService())};
}
const payment = {amount: '2400', paymentMethod: 'TEST_ONLY', referenceNo: 'fixture', occurredAt: '2026-01-02T03:04:05.000Z'};
function qualificationFixture(){
 const f=fixture(),relationships:any[]=[];let sequence=0;
 const tx={...f.tx,
  $queryRaw:jest.fn(async()=>[]),
  person:{findUnique:jest.fn(async()=>({personId:'person'}))},
  qualification:{findUnique:jest.fn(async({where}:any)=>({qualificationId:where.qualificationId})),create:jest.fn(async({data}:any)=>({...data,qualificationId:'created-'+(++sequence)}))},
  qualificationHolderHistory:{create:jest.fn(async({data}:any)=>data)},qualificationPlanHistory:{create:jest.fn(async({data}:any)=>data)},
  sponsorRelationship:{aggregate:jest.fn(async(_query:any)=>({_max:{sponsorSequenceNo:relationships.length?Math.max(...relationships.map(row=>row.sponsorSequenceNo)):null}})),create:jest.fn(async({data}:any)=>{relationships.push({...data});return data;})},
  binaryPlacement:{findFirst:jest.fn(async()=>null),create:jest.fn(async({data}:any)=>data)}
 };
 const prisma={idempotencyRecord:tx.idempotencyRecord,$transaction:jest.fn(async(work:any,_options:any)=>work(tx))};
 return {tx,relationships,audit:f.audit,service:new QualificationService(prisma as any,new IdempotencyService(prisma as any),f.audit as any,new OrganizationService(prisma as any))};
}
describe('UCell first vertical slice', () => {
  it('creates Person with idempotent command', async () => {
    const f = fixture(), dto = {legalName: 'TEST_ONLY Person', mobile: 'fixture-mobile'};
    const first = await f.person.create(dto, 'person-key', 'request', 'actor');
    expect(first).toEqual({value: {personId: 'person', legalName: dto.legalName, mobile: dto.mobile, status: 'DRAFT'}, replayed: false});
    expect(await f.person.create(dto, 'person-key', 'retry', 'actor')).toEqual({...first, replayed: true});
    await expect(f.person.create({...dto, legalName: 'changed'}, 'person-key', 'conflict', 'actor')).rejects.toMatchObject({response: {code: 'IDEMPOTENCY_CONFLICT'}});
    expect(f.tx.person.create).toHaveBeenCalledTimes(1);
    expect(f.audit.write).toHaveBeenCalledTimes(1);
    expect(f.audit.write.mock.calls[0][0]).toBe(f.tx);
  });
  it('creates Qualification with permanent sponsor sequence', async () => {
    const f=qualificationFixture(), dto={personId:'person',planLevelCode:'STARTER' as const,sponsorQualificationId:'sponsor',binaryParentQualificationId:'sponsor',binarySide:'LEFT' as const,effectiveAt:'2020-01-01T00:00:00.000Z'};
    const first=await f.service.create(dto,'first','request');
    expect(first.value.sponsor).toEqual({sponsorQualificationId:'sponsor',sponsorSequenceNo:1});
    expect(await f.service.create(dto,'first','retry')).toMatchObject({replayed:true,value:{qualification:{qualificationId:first.value.qualification.qualificationId}}});
    const second=await f.service.create({...dto,binaryParentQualificationId:'separate-parent'},'second','request');
    expect(second.value).toMatchObject({sponsor:{sponsorQualificationId:'sponsor',sponsorSequenceNo:2},binary:{parentQualificationId:'separate-parent',side:'LEFT'}});
    f.relationships[1].effectiveTo=new Date('2020-02-01'); // TEST_ONLY interval closure, not an exit workflow.
    expect((await f.service.create(dto,'third','request')).value.sponsor.sponsorSequenceNo).toBe(3);
    expect(f.relationships.map(row=>row.sponsorSequenceNo)).toEqual([1,2,3]);
    expect(f.tx.qualification.create).toHaveBeenCalledTimes(3);
    expect(f.tx.sponsorRelationship.aggregate).toHaveBeenCalledWith({where:{sponsorQualificationId:'sponsor'},_max:{sponsorSequenceNo:true}});
    expect(f.tx.qualificationHolderHistory.create.mock.calls[0][0].data).toMatchObject({qualificationId:first.value.qualification.qualificationId,holderPersonId:'person',effectiveFrom:new Date(dto.effectiveAt)});
    expect(f.tx.qualificationPlanHistory.create.mock.calls[0][0].data).toMatchObject({qualificationId:first.value.qualification.qualificationId,planCode:'STARTER',effectiveFrom:new Date(dto.effectiveAt)});
    expect(f.audit.write.mock.calls[0][0]).toBe(f.tx);
  });
  it('rejects 1st direct placed on RIGHT', async () => {
    const f=qualificationFixture();
    await expect(f.service.create({personId:'person',planLevelCode:'STARTER',sponsorQualificationId:'sponsor',binaryParentQualificationId:'sponsor',binarySide:'RIGHT'},'invalid','request')).rejects.toMatchObject({response:{code:'BINARY_LEFT_SUBTREE_REQUIRED'}});
    for(const model of [f.tx.qualification,f.tx.qualificationHolderHistory,f.tx.qualificationPlanHistory,f.tx.sponsorRelationship,f.tx.binaryPlacement])expect(model.create).not.toHaveBeenCalled();
    expect(f.audit.write).not.toHaveBeenCalled();
    expect(f.tx.idempotencyRecord.update).not.toHaveBeenCalled();
  });
  it('creates order using server-side Product Rule Profile snapshot', async () => {
    const f = fixture();
    const dto = {qualificationId: 'ball', items: [{productId: 'product', quantity: '2.5'}], clientReference: 'TEST_ONLY'};
    const result = await f.orders.create(dto, 'order-key', 'request');
    const data = f.tx.order.create.mock.calls[0][0].data, line = data.lines.create[0];
    expect(data).toMatchObject({qualificationId: 'ball', ruleVersionCode: 'TEST_ONLY', parameterSnapshotHash: 'sealed-hash', status: 'CONFIRMED'});
    expect([data.grossAmount.toString(), data.netAmount.toString(), data.discountAmount.toString()]).toEqual(['308.625', '308.625', '0']);
    expect([line.unitPrice.toString(), line.quantity.toString(), line.lineAmount.toString(), line.gpvRateSnapshot.toString(), line.gpvAmountSnapshot.toString(), line.pvRateSnapshot.toString()]).toEqual(['123.45', '2.5', '308.625', '0.4', '123.45', '0.2']);
    expect(line).toMatchObject({productId: 'product', skuSnapshot: 'TEST_ONLY_SKU', productNameSnapshot: 'TEST_ONLY Product'});
    expect(line.ruleProfileSnapshot).toEqual({profileId: 'profile', gpvRate: '0.4', pvRate: '0.2', rpvEligible: false, epvEligible: true, ruleVersionCode: 'TEST_ONLY', parameterSnapshotHash: 'sealed-hash'});
    expect(f.tx.productReference.findMany).toHaveBeenCalledWith({where: {productId: {in: ['product']}, isActive: true}});
    expect(f.tx.productRuleProfile.findFirst).toHaveBeenCalledWith({where: {productId: 'product', effectiveFrom: {lte: data.confirmedAt}, OR: [{effectiveTo: null}, {effectiveTo: {gt: data.confirmedAt}}]}, orderBy: {effectiveFrom: 'desc'}});
    f.tx.productRuleProfile.findFirst.mockResolvedValue(null);
    const duplicate = await f.orders.create(dto, 'order-key', 'retry');
    expect(duplicate.replayed).toBe(true);
    expect(duplicate.value.orderId).toBe(result.value.orderId);
    expect((duplicate.value.lines[0] as any).ruleProfileSnapshot).toEqual(line.ruleProfileSnapshot);
    expect(f.tx.order.create).toHaveBeenCalledTimes(1);
    expect(f.tx.productRuleProfile.findFirst).toHaveBeenCalledTimes(1);
    expect(f.audit.write.mock.calls[0][0]).toBe(f.tx);
    expect(f.tx.outboxEvent.create).not.toHaveBeenCalled();
  });
  it('rejects an order without an effective server-side profile before any order or outbox write', async () => {
    const f = fixture();
    f.tx.productRuleProfile.findFirst.mockResolvedValue(null);
    await expect(f.orders.create({qualificationId: 'ball', items: [{productId: 'product', quantity: '1'}]}, 'missing-profile', 'request')).rejects.toMatchObject({response: {code: 'DOMAIN_RULE_VIOLATION'}});
    expect(f.tx.order.create).not.toHaveBeenCalled();
    expect(f.tx.paymentEvent.create).not.toHaveBeenCalled();
    expect(f.tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(f.audit.write).not.toHaveBeenCalled();
    expect(f.tx.idempotencyRecord.update).not.toHaveBeenCalled();
  });
  it('confirms payment exactly once', async () => {
    const f = fixture(), first = await f.orders.confirmPayment('order', payment, 'payment-key', 'request');
    expect(first.value).toMatchObject({orderId: 'order', status: 'PAID', paymentEventId: 'payment'});
    expect(await f.orders.confirmPayment('order', payment, 'payment-key', 'retry')).toEqual({...first, replayed: true});
    await expect(f.orders.confirmPayment('order', payment, 'another-key', 'duplicate')).rejects.toMatchObject({response: {code: 'ORDER_LOCKED'}});
    expect(f.tx.paymentEvent.create).toHaveBeenCalledTimes(1);
    expect(f.tx.order.update).toHaveBeenCalledTimes(1);
    expect(f.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(f.tx.paymentEvent.create.mock.calls[0][0].data.amount.toString()).toBe('2400');
  });
  it('writes SALE_CONFIRMED to transactional outbox', async () => {
    const f = fixture();
    await f.orders.confirmPayment('order', payment, 'payment-key', 'request');
    const event = f.tx.outboxEvent.create.mock.calls[0][0].data;
    expect(event).toEqual({eventType: 'SALE_CONFIRMED', aggregateType: 'ORDER', aggregateId: 'order', correlationId: expect.any(String), payload: {eventType: 'SALE_CONFIRMED', source: 'MANUAL', orderId: 'order', qualificationId: 'ball', amount: '2400', occurredAt: payment.occurredAt, ruleVersionCode: 'TEST_ONLY', parameterSnapshotHash: 'sealed-hash'}});
    expect(event.correlationId).toBe(f.tx.paymentEvent.create.mock.calls[0][0].data.correlationId);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(f.prisma.$transaction.mock.calls[0][1]).toEqual({isolationLevel: 'Serializable'});
    expect(f.audit.write.mock.calls[0][0]).toBe(f.tx);
    await f.orders.confirmPayment('order', payment, 'payment-key', 'retry');
    expect(f.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });
  it('payment confirmation does not itself create VolumeRecognition',async()=>{const f=fixture();await f.orders.confirmPayment('order',payment,'recognition-boundary','request');expect(f.tx.paymentEvent.create).toHaveBeenCalledTimes(1);expect(f.tx.outboxEvent.create).toHaveBeenCalledTimes(1);expect(f.tx.pvLedger.create).not.toHaveBeenCalled();expect(f.tx.pvLedger.upsert).not.toHaveBeenCalled();});
  it('reprocessing same outbox event does not duplicate GPV',async()=>{
    const db=new PrismaService();
    try{
      const person=await db.person.findFirstOrThrow(),product=await db.productReference.findFirstOrThrow({where:{isActive:true}}),occurredAt=new Date(),effectiveFrom=new Date(occurredAt.getTime()-86400000);
      const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:effectiveFrom}});
      await db.qualificationHolderHistory.create({data:{qualificationId:qualification.qualificationId,holderPersonId:person.personId,effectiveFrom,sourceType:'WORKER_REDELIVERY_TEST'}});
      await db.qualificationPlanHistory.create({data:{qualificationId:qualification.qualificationId,planCode:'STARTER',effectiveFrom,sourceType:'WORKER_REDELIVERY_TEST'}});
      await db.qualificationStatusHistory.create({data:{qualificationId:qualification.qualificationId,status:'EFFECTIVE',effectiveFrom,sourceType:'WORKER_REDELIVERY_TEST'}});
      const order=await db.order.create({data:{qualificationId:qualification.qualificationId,purpose:'RETAIL',status:'PAID',grossAmount:1000,netAmount:1000,ruleVersionCode:'R1.0B',paidAt:occurredAt,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:1000,lineAmount:1000,gpvRateSnapshot:1,gpvAmountSnapshot:1000,ruleProfileSnapshot:{testOnly:true,case:'WORKER_REDELIVERY'}}}},include:{lines:true}});
      const event=await db.outboxEvent.create({data:{eventType:'SALE_CONFIRMED',aggregateType:'ORDER',aggregateId:order.orderId,correlationId:randomUUID(),payload:{eventType:'SALE_CONFIRMED',orderId:order.orderId,qualificationId:qualification.qualificationId,occurredAt:occurredAt.toISOString(),ruleVersionCode:'R1.0B'}}});
      const lease=await claimOutboxLease(db,event);expect(lease).not.toBeNull();
      await processSaleConfirmed(db,lease!);await processSaleConfirmed(db,lease!);
      const rows=await db.pvLedger.findMany({where:{sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,pvType:'GPV'}});
      expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({qualificationId:qualification.qualificationId,eventType:'GPV_CREATED'});expect(rows[0].amount.toString()).toBe('1000');
      expect(await db.historicalReplaySnapshot.count({where:{kind:'GPV',sourceId:rows[0].eventId}})).toBe(1);
      expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:event.outboxEventId}})).processStatus).toBe('PROCESSED');
    }finally{await db.$disconnect();}
  },30000);
  it('PV ledger cannot be UPDATEd or DELETEd', () => {
    const root=resolve(__dirname,'../../../..'), directory=mkdtempSync(join(tmpdir(),'ucell-pv-'));
    try {
      const file=join(directory,'evidence.json');
      execFileSync(process.execPath,[resolve(root,'backend/scripts/phase2-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public',PHASE2_DB_EVIDENCE_PATH:file},timeout:30000});
      const run=JSON.parse(readFileSync(file,'utf8'));expect(run.result).toBe('PASS');
      for(const label of ['PV Ledger UPDATE rejected by DB','PV Ledger DELETE rejected by DB','PV Ledger entire original row survives rejected mutations']){
        const row=run.results.find((item:any)=>item.label===label);
        expect(row).toBeDefined();expect(row.result).toBe('PASS');expect(row.actual).toEqual(row.expected);
      }
    } finally {rmSync(directory,{recursive:true,force:true});}
  },30000);
});
