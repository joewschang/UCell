import { ConflictException,Injectable,UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService,captureParameters,snapshotValue } from '@ucell/database';

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
    if(!input||typeof input.sku!=='string'||!input.sku.trim()||typeof input.displayName!=='string'||!input.displayName.trim()||typeof input.price!=='string'||!/^\d{1,16}(\.\d{1,2})?$/.test(input.price))throw new UnprocessableEntityException({code:'INVALID_PRODUCT_REFERENCE'});
    if(input.ruleVersionCode&&input.ruleVersionCode!=='R1.0B')throw new UnprocessableEntityException({code:'RULE_VERSION_CONFIGURATION_PENDING'});
    if(input.gpvRate!==undefined&&(!/^\d+(\.\d{1,6})?$/.test(input.gpvRate)||new Prisma.Decimal(input.gpvRate).gt(1)))throw new UnprocessableEntityException({code:'INVALID_PRODUCT_RATE'});
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
        const at=new Date(),snapshot=await captureParameters(tx,at,'R1.0B');
        snapshotValue(snapshot,'accounting.timezone');
        await tx.productRuleProfile.create({
          data: {
            productId: product.productId,
            effectiveFrom: at,
            gpvRate: new Prisma.Decimal(input.gpvRate ?? '0.60'),
            ruleVersionCode: input.ruleVersionCode ?? 'R1.0B',
            parameterSnapshotHash:snapshot.hash,
          },
        });
      }else if(input.gpvRate!==undefined&&!active.gpvRate.eq(input.gpvRate)){
        throw new ConflictException({code:'VERSIONED_PRODUCT_PROFILE_REQUIRED',message:'Existing rate changes require a separately approved prospective profile; the original profile is not overwritten.'});
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
