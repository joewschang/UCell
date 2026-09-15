import { Prisma } from '@ucell/database';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { OutboxService } from '../src/common/outbox/outbox.service';
import { PersonService } from '../src/modules/person/person.service';
import { OrderService } from '../src/modules/order/order.service';

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
    outboxEvent: { create: jest.fn(async ({data}: any) => ({outboxEventId: 'outbox', ...data})) },
  };
  const prisma = {idempotencyRecord: tx.idempotencyRecord, $transaction: jest.fn(async (work: any, _options: any) => work(tx))};
  const audit = {write: jest.fn(async (_tx: any, _event: any) => undefined)};
  const idempotency = new IdempotencyService(prisma as any);
  return {tx, prisma, audit, person: new PersonService(prisma as any, idempotency, audit as any), orders: new OrderService(prisma as any, idempotency, audit as any, new OutboxService())};
}
const payment = {amount: '2400', paymentMethod: 'TEST_ONLY', referenceNo: 'fixture', occurredAt: '2026-01-02T03:04:05.000Z'};
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
  it.todo('creates Qualification with permanent sponsor sequence');
  it.todo('rejects 1st direct placed on RIGHT');
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
  it.todo('worker converts SALE_CONFIRMED to GPV_CREATED per order line');
  it.todo('reprocessing same outbox event does not duplicate GPV');
  it.todo('PV ledger cannot be UPDATEd or DELETEd');
});
