import { Injectable } from '@nestjs/common';
import { Prisma } from '@ucell/database';

@Injectable()
export class AuditService {
  async write(
    tx: Prisma.TransactionClient,
    input: {
      actorType: string;
      actorId?: string;
      action: string;
      entityType: string;
      entityId?: string;
      beforeData?: unknown;
      afterData?: unknown;
      reasonCode?: string;
      requestId: string;
      correlationId: string;
    },
  ) {
    return tx.auditEvent.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeData: input.beforeData as Prisma.InputJsonValue | undefined,
        afterData: input.afterData as Prisma.InputJsonValue | undefined,
        reasonCode: input.reasonCode,
        requestId: input.requestId,
        correlationId: input.correlationId,
      },
    });
  }
}
