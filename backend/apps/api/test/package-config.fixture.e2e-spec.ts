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
    await expect(db.$transaction(async (tx) => {
      const f = await createActiveQualificationPackage(tx as any);
      const person = await tx.person.create({ data: { legalName: 'Package fixture purchaser', status: 'EFFECTIVE' } });
      const read: any = await new PackageConfigService(tx as any).checkoutData(
        tx as any,
        person.personId,
        { packageVersionId: f.version.packageProfileVersionId, selections: [{ productRuleProfileId: f.rule.productRuleProfileId, quantity: 1 }] },
        new Date(),
      );
      expect(read.version.status).toBe('ACTIVE');
      expect(read.selections).toHaveLength(1);
      throw new Error('ROLLBACK');
    })).rejects.toThrow('ROLLBACK');
  });
});
