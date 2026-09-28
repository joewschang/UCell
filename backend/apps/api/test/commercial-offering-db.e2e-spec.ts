import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CommercialOfferingService } from '../src/modules/order/commercial-offering.service';

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
});