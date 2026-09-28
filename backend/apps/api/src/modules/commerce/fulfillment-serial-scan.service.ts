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
      if (unit.batch.product.sku !== source.skuSnapshot || source.orderLine.productId !== unit.batch.productId) throw new ConflictException({ code: 'SERIAL_SKU_MISMATCH' });
      const existing = unit.fulfillmentAllocations[0];
      if (existing) {
        if (existing.fulfillmentSourceAllocationId === source.fulfillmentSourceAllocationId) return { allocation: existing, replayed: true };
        throw new ConflictException({ code: 'SERIAL_ALREADY_ALLOCATED' });
      }
      const scanned = await tx.fulfillmentSerialAllocation.count({ where: { fulfillmentSourceAllocationId: source.fulfillmentSourceAllocationId } });
      if (scanned >= source.allocatedQuantity.toNumber()) throw new ConflictException({ code: 'FULFILLMENT_SOURCE_QUANTITY_EXCEEDED' });
      const claimed = await tx.serializedUnit.updateMany({ where: { serializedUnitId: unit.serializedUnitId, status: 'AVAILABLE' }, data: { status: 'ALLOCATED' } });
      if (claimed.count !== 1) throw new ConflictException({ code: 'SERIAL_NOT_AVAILABLE' });
      const allocation = await tx.fulfillmentSerialAllocation.create({ data: { fulfillmentId: source.fulfillmentId, fulfillmentSourceAllocationId: source.fulfillmentSourceAllocationId, serializedUnitId: unit.serializedUnitId, scannedByActor: input.actorId, scannedAt: new Date(), correlationId: input.correlationId } });
      await this.audit.write(tx, { actorType: 'USER', actorId: input.actorId, action: 'FULFILLMENT_SERIAL_SCANNED', entityType: 'FULFILLMENT', entityId: source.fulfillmentId, afterData: { fulfillmentSourceAllocationId: source.fulfillmentSourceAllocationId, serialNo, sku: source.skuSnapshot }, requestId: input.requestId, correlationId: input.correlationId });
      return { allocation, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
