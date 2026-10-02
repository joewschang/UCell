import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';

@Injectable()
export class FulfillmentSourceAllocationService {
  constructor(private readonly db: PrismaService) {}
  async allocate(tx: Prisma.TransactionClient, input: { fulfillmentId: string; orderLineId: string; quantity: string }) {
    const quantity = new Prisma.Decimal(input.quantity);
    if (!quantity.isFinite() || quantity.lte(0)) throw new UnprocessableEntityException({ code: 'FULFILLMENT_ALLOCATION_QUANTITY_INVALID' });
    await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${input.fulfillmentId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT order_line_id FROM commerce.order_line WHERE order_line_id=${input.orderLineId}::uuid FOR UPDATE`;
    const [fulfillment, line] = await Promise.all([
      tx.fulfillment.findUnique({ where: { fulfillmentId: input.fulfillmentId } }),
      tx.orderLine.findUnique({ where: { orderLineId: input.orderLineId } }),
    ]);
    if (!fulfillment || !line || fulfillment.orderId !== line.orderId) throw new ConflictException({ code: 'FULFILLMENT_ALLOCATION_SOURCE_MISMATCH' });
    if (quantity.gt(line.quantity)) throw new UnprocessableEntityException({ code: 'FULFILLMENT_ALLOCATION_EXCEEDS_ORDER_LINE' });
    const existing = await tx.fulfillmentSourceAllocation.findUnique({ where: { fulfillmentId_orderLineId: { fulfillmentId: input.fulfillmentId, orderLineId: input.orderLineId } } });
    if (existing) {
      if (!existing.allocatedQuantity.equals(quantity)) throw new ConflictException({ code: 'FULFILLMENT_ALLOCATION_CONFLICT' });
      return existing;
    }
    if (await tx.fulfillmentErpHandoff.findUnique({where:{fulfillmentId:input.fulfillmentId}})) throw new ConflictException({code:'FULFILLMENT_INTENT_LOCKED'});
    if (['PACKED','SHIPPING_REQUESTED','SHIPPED','DELIVERED','CANCELLED','EXCEPTION'].includes(fulfillment.status)) throw new ConflictException({code:'FULFILLMENT_NOT_ALLOCATABLE'});
    const allocated=await tx.fulfillmentSourceAllocation.aggregate({where:{orderLineId:input.orderLineId},_sum:{allocatedQuantity:true}});
    if ((allocated._sum.allocatedQuantity??new Prisma.Decimal(0)).plus(quantity).gt(line.quantity)) throw new ConflictException({code:'FULFILLMENT_ALLOCATION_EXCEEDS_ORDER_LINE'});
    return tx.fulfillmentSourceAllocation.create({ data: { fulfillmentId: input.fulfillmentId, orderLineId: input.orderLineId, allocatedQuantity: quantity, skuSnapshot: line.skuSnapshot, commercialOfferingSnapshot: line.commercialOfferingSnapshot ?? undefined, linePurpose: line.linePurpose } });
  }
}
