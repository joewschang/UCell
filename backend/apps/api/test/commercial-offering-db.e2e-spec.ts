import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CommercialOfferingService } from '../src/modules/order/commercial-offering.service';
import { CommercialOfferingConfigService } from '../src/modules/order/commercial-offering-config.service';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { AuditService } from '../src/common/audit/audit.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('commercial offering foundation', () => {
  let db: PrismaClient;
  beforeAll(() => { db = new PrismaClient({ datasources: { db: { url } } }); });
  afterAll(() => db.$disconnect());

  it('resolves exactly one active channel-approved version into an immutable order snapshot', async () => {
    const token = randomUUID();
    const offering = await db.commercialOffering.create({
      data: { offeringCode: `RET-${token}`, offeringType: 'RETAIL_PRODUCT', status: 'ACTIVE' },
    });
    const version = await db.commercialOfferingVersion.create({
      data: {
        commercialOfferingId: offering.commercialOfferingId,
        version: 1,
        status: 'ACTIVE',
        effectiveFrom: new Date(Date.now() - 60_000),
        channels: ['WEB_MEMBER'],
        composition: [{ sku: `SKU-${token}`, quantity: 1 }],
        approvalReference: `APP-${token}`,
        snapshotHash: 'b'.repeat(64),
      },
    });
    const service = new CommercialOfferingService();
    const snapshot = await db.$transaction(tx => service.resolveEffective(tx as any, {
      offeringCode: offering.offeringCode, channel: 'WEB_MEMBER', at: new Date(),
    }));
    expect(snapshot).toMatchObject({
      commercialOfferingVersionId: version.commercialOfferingVersionId,
      offeringCode: offering.offeringCode,
      offeringType: 'RETAIL_PRODUCT', version: 1, snapshotHash: 'b'.repeat(64),
    });
    const frozen = JSON.parse(JSON.stringify(snapshot));
    await db.commercialOffering.update({ where: { commercialOfferingId: offering.commercialOfferingId }, data: { status: 'RETIRED' } });
    expect(frozen).toEqual(snapshot);
    await expect(db.$transaction(tx => service.resolveEffective(tx as any, {
      offeringCode: offering.offeringCode, channel: 'ADMIN', at: new Date(),
    }))).rejects.toMatchObject({ response: { code: 'COMMERCIAL_OFFERING_NOT_AVAILABLE' } });
  });
  it('publishes an offering through the governed lifecycle and exposes only its effective channel version', async () => {
    const actor = await db.person.create({ data: { legalName: `Offering actor ${randomUUID()}`, status: 'EFFECTIVE' } });
    const service = new CommercialOfferingConfigService(db as any, new IdempotencyService(db as any), new AuditService());
    const offering: any = await service.createOffering({ offeringCode: `CORE-${randomUUID()}`, offeringType: 'CORE_PRODUCT' }, randomUUID(), randomUUID(), actor.personId);
    const draft: any = await service.addVersion(offering.value.commercialOfferingId, {
      channels: ['WEB_MEMBER'], composition: [{ product: 'PHYSICAL_SKU', quantity: 1 }],
      effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
    }, randomUUID(), randomUUID(), actor.personId);
    expect(draft.value.status).toBe('DRAFT');
    const approved: any = await service.approve(draft.value.commercialOfferingVersionId, 'CO-APPROVED', randomUUID(), randomUUID(), actor.personId);
    expect(approved.value.status).toBe('APPROVED');
    const active: any = await service.activate(draft.value.commercialOfferingVersionId, randomUUID(), randomUUID(), actor.personId);
    expect(active.value.status).toBe('ACTIVE');
    const memberOfferings=await service.memberList('WEB_MEMBER');expect(memberOfferings).toEqual(expect.arrayContaining([expect.objectContaining({ offeringCode: offering.value.offeringCode, offeringTypeLabel:'主商品', version: 1 })]));expect(JSON.stringify(memberOfferings)).not.toContain('commercialOfferingVersionId');expect(JSON.stringify(memberOfferings)).not.toContain('CORE_PRODUCT');
    expect(await service.memberList('ADMIN')).not.toEqual(expect.arrayContaining([expect.objectContaining({ offeringCode: offering.value.offeringCode })]));
    expect(await db.auditEvent.count({ where: { action: { in: ['COMMERCIAL_OFFERING_CREATED', 'COMMERCIAL_OFFERING_VERSION_CREATED', 'COMMERCIAL_OFFERING_VERSION_APPROVED', 'COMMERCIAL_OFFERING_VERSION_ACTIVATED'] } } })).toBeGreaterThanOrEqual(4);
  });
});