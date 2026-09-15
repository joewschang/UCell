import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = [
    { sku: 'UCELL-MAIN-4800', displayName: 'UCell 主商品', price: '4800.00' },
  ];

  for (const p of products) {
    const product = await prisma.productReference.upsert({
      where: { sku: p.sku },
      update: { displayName: p.displayName, currentPrice: new Prisma.Decimal(p.price), isActive: true },
      create: { sku: p.sku, displayName: p.displayName, currentPrice: new Prisma.Decimal(p.price) },
    });

    const active = await prisma.productRuleProfile.findFirst({
      where: { productId: product.productId, effectiveTo: null },
    });

    if (!active) {
      await prisma.productRuleProfile.create({
        data: {
          productId: product.productId,
          effectiveFrom: new Date('2026-09-01T00:00:00+08:00'),
          gpvRate: new Prisma.Decimal('0.60'),
          ruleVersionCode: 'R1.0B',
        },
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
