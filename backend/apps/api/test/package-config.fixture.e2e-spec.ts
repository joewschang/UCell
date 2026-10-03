import { PrismaClient } from '@prisma/client';
import { createActiveQualificationPackage } from './helpers/package-config.fixture';
import { PackageConfigService } from '../src/modules/package-config/package-config.service';
import { ProductService } from '../src/modules/product/product.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('isolated qualification package fixture', () => {
  let db: PrismaClient;
  beforeAll(() => { db = new PrismaClient({ datasources: { db: { url } } }); });
  afterAll(() => db.$disconnect());

  it('persists editable icons, exposes them in package selections, and preserves omitted icons and rule profiles', async () => {
    const f = await createActiveQualificationPackage(db);
    const service = new ProductService(db as any);
    const input = {sku:f.product.sku,displayName:f.product.displayName,price:f.product.currentPrice.toString()};
    await service.upsertReference({...input,iconUrl:'/products/tip-363.png'});
    await service.upsertReference(input);
    const read = await new PackageConfigService(db as any).memberProducts(f.version.packageProfileVersionId);
    expect(read.products[0].iconUrl).toBe('/products/tip-363.png');
    expect(read.products[0].productRuleProfileId).toBe(f.rule.productRuleProfileId);
    await expect(service.upsertReference({...input,iconUrl:'https://tracker.invalid/image.png'})).rejects.toMatchObject({response:{code:'INVALID_PRODUCT_ICON_URL'}});
    await service.upsertReference({...input,iconUrl:''});
    expect((await db.productReference.findUniqueOrThrow({where:{productId:f.product.productId}})).iconUrl).toBeNull();
  });

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
