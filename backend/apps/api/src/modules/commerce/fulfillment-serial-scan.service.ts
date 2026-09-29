import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class FulfillmentSerialScanService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async scan(input: { fulfillmentSourceAllocationId: string; serialNo: string; actorId: string; requestId: string; correlationId: string }) {
    const serialNo = input.serialNo.trim().toUpperCase();
    if (!/^[A-E][0-9]{7}$/.test(serialNo)) throw new UnprocessableEntityException({ code: 'INVALID_SERIAL_NO' });
    return this.prisma.$transaction(async tx => {
      // All scans for a fulfillment serialize before counting quantity. Lock the
      // unit as well because another fulfillment may claim the same serial.
      await tx.$queryRaw`SELECT f.fulfillment_id FROM commerce.fulfillment f JOIN commerce.fulfillment_source_allocation a ON a.fulfillment_id=f.fulfillment_id WHERE a.fulfillment_source_allocation_id=${input.fulfillmentSourceAllocationId}::uuid FOR UPDATE OF f`;
      await tx.$queryRaw`SELECT serialized_unit_id FROM commerce.serialized_unit WHERE serial_no=${serialNo} FOR UPDATE`;
      const source = await tx.fulfillmentSourceAllocation.findUnique({
        where: { fulfillmentSourceAllocationId: input.fulfillmentSourceAllocationId },
        include: { fulfillment: true, orderLine: true },
      });
      if (!source) throw new ConflictException({ code: 'FULFILLMENT_SOURCE_ALLOCATION_NOT_FOUND' });
      if (!source.allocatedQuantity.isInteger() || source.allocatedQuantity.lte(0)) throw new ConflictException({ code: 'SERIAL_SCAN_REQUIRES_WHOLE_UNIT_ALLOCATION' });
      const unit = await tx.serializedUnit.findUnique({ where: { serialNo }, include: { batch: { include: { product: true } }, fulfillmentAllocations: true } });
      if (!unit) throw new ConflictException({ code: 'SERIAL_NOT_FOUND' });
      const expected = `${unit.batch.serialPrefix}${String(unit.batch.batchSequence).padStart(3, '0')}${String(unit.serialSequence).padStart(4, '0')}`;
      if (unit.serialNo !== expected) throw new ConflictException({ code: 'SERIAL_FORMAT_BATCH_MISMATCH' });
      const prefixes:Record<string,string>={'TIP-363':'A','TIP-999':'B','TIP-580':'C','TIP-696':'D','TIP-777':'E'};
      if (prefixes[unit.batch.product.sku] && prefixes[unit.batch.product.sku] !== unit.batch.serialPrefix) throw new ConflictException({code:'SERIAL_PRODUCT_PREFIX_MISMATCH'});
      if (unit.batch.product.sku !== source.skuSnapshot || source.orderLine.productId !== unit.batch.productId) throw new ConflictException({ code: 'SERIAL_SKU_MISMATCH' });
      if (unit.status === 'SHIPPED') throw new ConflictException({code:'SERIAL_ALREADY_SHIPPED'});
      if (unit.batch.status !== 'EFFECTIVE' || (unit.batch.expiresAt && unit.batch.expiresAt.getTime() <= Date.now())) throw new ConflictException({code:'SERIAL_BATCH_INELIGIBLE'});
      if (unit.status !== 'AVAILABLE' && unit.status !== 'ALLOCATED') throw new ConflictException({code:'SERIAL_NOT_AVAILABLE'});
      const existing = unit.fulfillmentAllocations[0];
      if (existing) {
        if (existing.fulfillmentSourceAllocationId === source.fulfillmentSourceAllocationId) return { allocation: existing, replayed: true };
        throw new ConflictException({ code: 'SERIAL_ALREADY_ALLOCATED' });
      }
      if (['PACKED','SHIPPING_REQUESTED','SHIPPED','DELIVERED','CANCELLED','EXCEPTION'].includes(source.fulfillment.status)) throw new ConflictException({code:'FULFILLMENT_NOT_SCANNABLE'});
      if (await tx.fulfillmentErpHandoff.findUnique({where:{fulfillmentId:source.fulfillmentId}})) throw new ConflictException({code:'FULFILLMENT_INTENT_LOCKED'});
      const scanned = await tx.fulfillmentSerialAllocation.count({ where: { fulfillmentSourceAllocationId: source.fulfillmentSourceAllocationId } });
      if (scanned >= source.allocatedQuantity.toNumber()) throw new ConflictException({ code: 'FULFILLMENT_SOURCE_QUANTITY_EXCEEDED' });
      const claimed = await tx.serializedUnit.updateMany({ where: { serializedUnitId: unit.serializedUnitId, status: 'AVAILABLE' }, data: { status: 'ALLOCATED' } });
      if (claimed.count !== 1) throw new ConflictException({ code: 'SERIAL_NOT_AVAILABLE' });
      const allocation = await tx.fulfillmentSerialAllocation.create({ data: { fulfillmentId: source.fulfillmentId, fulfillmentSourceAllocationId: source.fulfillmentSourceAllocationId, serializedUnitId: unit.serializedUnitId, scannedByActor: input.actorId, scannedAt: new Date(), correlationId: input.correlationId } });
      await this.audit.write(tx, { actorType: 'USER', actorId: input.actorId, action: 'FULFILLMENT_SERIAL_SCANNED', entityType: 'FULFILLMENT', entityId: source.fulfillmentId, afterData: { fulfillmentSourceAllocationId: source.fulfillmentSourceAllocationId, serialNo, sku: source.skuSnapshot }, requestId: input.requestId, correlationId: input.correlationId });
      return { allocation, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
