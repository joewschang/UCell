import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createEffectiveMemberSponsorFixture } from './helpers/member-sponsor.fixture';
import { RetailReferrerAttributionService } from '../src/modules/order/retail-referrer-attribution.service';
import { SponsorResolver } from '../src/modules/qualification/sponsor-resolver.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('RETAIL_ATTRIBUTION_CONCURRENCY', () => {
  let db: PrismaClient;

  beforeAll(() => {
    db = new PrismaClient({ datasources: { db: { url } } });
  });
  afterAll(() => db.$disconnect());

  it('allows exactly one independently valid first-order candidate to persist', async () => {
    const sponsorA = await createEffectiveMemberSponsorFixture(db);
    const sponsorB = await createEffectiveMemberSponsorFixture(db);
    const buyer = await db.person.create({
      data: { legalName: `Retail race ${randomUUID()}`, status: 'EFFECTIVE' },
    });
    const order = await db.order.create({
      data: {
        purchaserPersonId: buyer.personId,
        purpose: 'RETAIL',
        status: 'DRAFT',
        currency: 'TWD',
        grossAmount: new Prisma.Decimal(0),
        netAmount: new Prisma.Decimal(0),
        ruleVersionCode: 'R1.0B',
      },
    });
    const at = new Date();

    const resolve = async (candidateCode: string) => {
      const client = new PrismaClient({ datasources: { db: { url } } });
      const service = new RetailReferrerAttributionService(
        client as never,
        new SponsorResolver(client as never),
      );
      try {
        return await client.$transaction((tx) =>
          service.resolveForRetailOrder(tx as never, {
            personId: buyer.personId,
            candidateCode,
            orderId: order.orderId,
            at,
            correlationId: randomUUID(),
          }),
        );
      } finally {
        await client.$disconnect();
      }
    };

    const [first, second] = await Promise.allSettled([
      resolve(sponsorA.qualification.ballNo!),
      resolve(sponsorB.qualification.ballNo!),
    ]);
    const fulfilled = [first, second].filter(
      (result): result is PromiseFulfilledResult<unknown> => result.status === 'fulfilled',
    );
    const rejected = [first, second].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const surviving = await db.retailReferrerAttribution.findMany({
      where: { personId: buyer.personId },
      include: { events: true },
    });
    expect(surviving).toHaveLength(1);
    expect([sponsorA.qualification.ballNo, sponsorB.qualification.ballNo]).toContain(
      surviving[0].referrerBallNoSnapshot,
    );
    expect(surviving[0].effectiveFrom).toEqual(at);
    expect(surviving[0].effectiveTo).toBeNull();
    expect(surviving[0].events).toHaveLength(1);

    const retry = new RetailReferrerAttributionService(
      db as never,
      new SponsorResolver(db as never),
    );
    const retried = await db.$transaction((tx) =>
      retry.resolveForRetailOrder(tx as never, {
        personId: buyer.personId,
        candidateCode: surviving[0].referrerBallNoSnapshot,
        orderId: order.orderId,
        at,
        correlationId: randomUUID(),
      }),
    );
    expect(retried?.retailReferrerAttributionId).toBe(
      surviving[0].retailReferrerAttributionId,
    );
    expect(await db.retailReferrerAttribution.count({ where: { personId: buyer.personId } })).toBe(1);
  });
});
