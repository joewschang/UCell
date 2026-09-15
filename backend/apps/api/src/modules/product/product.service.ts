import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertReference(input: {
    sku: string;
    displayName: string;
    price: string;
    gpvRate?: string;
    ruleVersionCode?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.productReference.upsert({
        where: { sku: input.sku },
        update: {
          displayName: input.displayName,
          currentPrice: new Prisma.Decimal(input.price),
          isActive: true,
        },
        create: {
          sku: input.sku,
          displayName: input.displayName,
          currentPrice: new Prisma.Decimal(input.price),
        },
      });

      const active = await tx.productRuleProfile.findFirst({
        where: { productId: product.productId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (!active) {
        await tx.productRuleProfile.create({
          data: {
            productId: product.productId,
            effectiveFrom: new Date(),
            gpvRate: new Prisma.Decimal(input.gpvRate ?? '0.60'),
            ruleVersionCode: input.ruleVersionCode ?? 'R1.0B',
          },
        });
      }

      return product;
    });
  }

  async list() {
    return this.prisma.productReference.findMany({
      where: { isActive: true },
      include: { ruleProfiles: { where: { effectiveTo: null }, take: 1, orderBy: { effectiveFrom: 'desc' } } },
      orderBy: { sku: 'asc' },
    });
  }
}
