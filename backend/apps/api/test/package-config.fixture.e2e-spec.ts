import { PrismaClient } from '@prisma/client';
import { createActiveQualificationPackage } from './helpers/package-config.fixture';
import { PackageConfigService } from '../src/modules/package-config/package-config.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('isolated qualification package fixture', () => {
  let db: PrismaClient;
  beforeAll(() => { db = new PrismaClient({ datasources: { db: { url } } }); });
  afterAll(() => db.$disconnect());

  it('creates an active package accepted by the authoritative checkout read', async () => {
    const f = await createActiveQualificationPackage(db);
    const person = await db.person.create({ data: { legalName: 'Package fixture purchaser', status: 'EFFECTIVE' } });
    const read: any = await new PackageConfigService(db as any).checkoutData(
      db as any,
      person.personId,
      { packageVersionId: f.version.packageProfileVersionId, selections: [{ productRuleProfileId: f.rule.productRuleProfileId, quantity: 1 }] },
      new Date(),
    );
    expect(read.version.status).toBe('ACTIVE');
    expect(read.selections).toHaveLength(1);
  });
});
