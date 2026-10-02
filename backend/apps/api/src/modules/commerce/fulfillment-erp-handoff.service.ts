import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { createHash } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { verifySerialPack } from './fulfillment-pack-verification.service';

@Injectable()
export class FulfillmentErpHandoffService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async request(input: { fulfillmentId: string; actorId: string; requestId: string; correlationId: string; providerCode?: string }) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${input.fulfillmentId}::uuid FOR UPDATE`;
      const fulfillment = await tx.fulfillment.findUnique({
        where: { fulfillmentId: input.fulfillmentId },
        include: { order: { select: { orderNo: true } }, sourceAllocations: { include: { serialAllocations: { include: { serializedUnit: true } } }, orderBy: { fulfillmentSourceAllocationId: 'asc' } } },
      });
      if (!fulfillment) throw new ConflictException({ code: 'FULFILLMENT_NOT_FOUND' });
      const replay = await tx.fulfillmentErpHandoff.findUnique({ where: { fulfillmentId: fulfillment.fulfillmentId } });
      if (replay) return { handoff: replay, replayed: true };
      // Verification and durable handoff commit together. Explicit warehouse
      // verification is also available through the same immutable QC authority.
      await verifySerialPack(tx,this.audit,input);
      if (!fulfillment.sourceAllocations.length) throw new ConflictException({ code: 'FULFILLMENT_SOURCE_ALLOCATION_REQUIRED' });
      for (const source of fulfillment.sourceAllocations) {
        if (!source.allocatedQuantity.isInteger() || source.serialAllocations.length !== source.allocatedQuantity.toNumber()) {
          throw new ConflictException({ code: 'FULFILLMENT_SERIAL_SCAN_INCOMPLETE' });
        }
      }
      const payload = {
        schemaVersion: 1,
        format: 'UCELL_FULFILLMENT_ERP_V1',
        fulfillmentKey: fulfillment.fulfillmentKey,
        orderNo: fulfillment.order.orderNo.toString(),
        lines: fulfillment.sourceAllocations.map(source => ({ sku: source.skuSnapshot, quantity: source.allocatedQuantity.toString(), serialNos: source.serialAllocations.map(row => row.serializedUnit.serialNo).sort() })),
      };
      const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const outbox = await tx.outboxEvent.create({ data: { eventType: 'FULFILLMENT_ERP_HANDOFF_REQUESTED', aggregateType: 'FULFILLMENT', aggregateId: fulfillment.fulfillmentId, payload, correlationId: input.correlationId } });
      const handoff = await tx.fulfillmentErpHandoff.create({ data: { fulfillmentId: fulfillment.fulfillmentId, outboxEventId: outbox.outboxEventId, providerCode: input.providerCode?.trim() || 'ERP_PENDING', formatVersion: 'UCELL_FULFILLMENT_ERP_V1', payloadHash, payloadSnapshot: payload, requestedByActor: input.actorId } });
      await this.audit.write(tx, { actorType: 'USER', actorId: input.actorId, action: 'FULFILLMENT_ERP_HANDOFF_REQUESTED', entityType: 'FULFILLMENT', entityId: fulfillment.fulfillmentId, afterData: { fulfillmentKey: fulfillment.fulfillmentKey, orderNo: fulfillment.order.orderNo.toString(), payloadHash, providerCode: handoff.providerCode }, requestId: input.requestId, correlationId: input.correlationId });
      return { handoff, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
