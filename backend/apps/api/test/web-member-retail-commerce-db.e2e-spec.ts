import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuditService } from '../src/common/audit/audit.service';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { OutboxService } from '../src/common/outbox/outbox.service';
import { PiiCryptoService } from '../src/common/security/pii-crypto.service';
import { DeliveryProfileService } from '../src/modules/member/delivery-profile.service';
import { OrderService } from '../src/modules/order/order.service';
import { RetailReferrerAttributionService } from '../src/modules/order/retail-referrer-attribution.service';
import { SponsorResolver } from '../src/modules/qualification/sponsor-resolver.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('WEB_MEMBER_RETAIL_COMMERCE_REAL_DB', () => {
  let db: PrismaClient;

  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.PII_ENCRYPTION_KEY_VERSION = 'isolated-v1';
    db = new PrismaClient({ datasources: { db: { url } } });
  });
  afterAll(() => db.$disconnect());

  it.each([false,true])('preserves no-Ball retail and approved core PV/GPV snapshots (core=%s)', async (core) => {
    const person = await db.person.create({ data: { legalName: `Retail member ${randomUUID()}`, status: 'EFFECTIVE' } });
    const idempotency = new IdempotencyService(db as any);
    const audit = new AuditService();
    const outbox = new OutboxService();
    const delivery = new DeliveryProfileService(db as any, idempotency, audit, new PiiCryptoService());
    const retail = new RetailReferrerAttributionService(db as any, new SponsorResolver(db as any));
    const orderService = new OrderService(db as any, idempotency, audit, outbox, undefined, undefined, undefined, retail);
    const product = await db.productReference.create({
      data: { sku: `RETAIL-${randomUUID()}`, displayName: 'Retail product', currentPrice: new Prisma.Decimal(core?4800:100), isActive: true },
    });
    await db.productRuleProfile.create({
      data: {
        productId: product.productId, effectiveFrom: new Date(Date.now() - 60_000),
        gpvRate: new Prisma.Decimal(0.6), pvRate: new Prisma.Decimal(0.6), ruleVersionCode: 'R1.0B',
        parameterSnapshotHash: 'a'.repeat(64), retailReferralEnabled: false,
      },
    });

    await expect(orderService.createMember({ items: [{ productId: product.productId, quantity: '1' }] }, randomUUID(), randomUUID(), person.personId))
      .rejects.toMatchObject({ response: { code: 'DELIVERY_PROFILE_REQUIRED' } });

    await delivery.update(person.personId, {
      recipientName: 'Synthetic Recipient', phone: '0900000000', countryCode: 'TW',
      postalCode: '100', region: 'Taipei', city: 'Taipei', address: 'Synthetic address',
    }, randomUUID(), randomUUID());

    let commercialOfferingCode: string|undefined;
    if(core){
      const o=await db.commercialOffering.create({data:{offeringCode:'CORE-'+randomUUID(),offeringType:'CORE_PRODUCT',status:'ACTIVE'}});
      await db.commercialOfferingVersion.create({data:{commercialOfferingId:o.commercialOfferingId,version:1,status:'ACTIVE',effectiveFrom:new Date(Date.now()-60000),channels:['WEB_MEMBER'],approvalReference:'TEST_CONFIRMED_60_PERCENT',snapshotHash:'b'.repeat(64),recognitionProfile:{recognitionStatus:'USER_CONFIRMED'}}});
      commercialOfferingCode=o.offeringCode;
    }
    const request = { commercialOfferingCode, items: [{ productId: product.productId, quantity: '2' }], clientReference: 'retail-e2e' };
    const key = randomUUID();
    const created: any = await orderService.createMember(request, key, randomUUID(), person.personId);
    const replay: any = await orderService.createMember(request, key, randomUUID(), person.personId);
    expect(created.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(created.value).toMatchObject({ purpose: 'RETAIL', status: 'CONFIRMED', qualificationId: null });
    expect(created.value.lines).toHaveLength(1);
    expect(created.value.netAmount).toEqual(new Prisma.Decimal(core?9600:200));

    expect(created.value.lines[0].gpvRateSnapshot.toString()).toBe(core?'0.6':'0');
    expect(created.value.lines[0].pvRateSnapshot.toString()).toBe(core?'0.6':'0');
    expect(created.value.lines[0].gpvAmountSnapshot.toString()).toBe(core?'5760':'0');
    const snapshot = await db.retailReferralOrderLineSnapshot.findUniqueOrThrow({
      where: { orderLineId: created.value.lines[0].orderLineId },
    });
    expect(snapshot).toMatchObject({ retailReferralEnabled: false, referrerQualificationId: null });
    const history = await orderService.listWebRetailMember(person.personId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ orderNo: created.value.orderNo.toString(), status: 'CONFIRMED', total: core?'9600':'200', itemCount: 2 });
    expect(JSON.stringify(history)).not.toContain(person.personId);
    expect(JSON.stringify(history)).not.toContain('Synthetic Recipient');
  });
});
