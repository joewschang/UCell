import { Injectable } from '@nestjs/common';
import { Prisma } from '@ucell/database';

@Injectable()
export class OutboxService {
  async enqueue(
    tx: Prisma.TransactionClient,
    event: {
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: unknown;
      correlationId: string;
    },
  ) {
    return tx.outboxEvent.create({
      data: {
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as Prisma.InputJsonValue,
        correlationId: event.correlationId,
      },
    });
  }
}
