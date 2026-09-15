import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { requestHash } from '../utils/hash';
import { toJsonSafe } from '../utils/json-safe';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    actorScope: string,
    key: string,
    request: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ value: T; replayed: boolean }> {
    const hash = requestHash(request);

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { actorScope_idempotencyKey: { actorScope, idempotencyKey: key } },
    });

    if (existing) {
      if (existing.requestHash !== hash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: '相同 Idempotency-Key 已被不同內容使用。',
        });
      }
      if (existing.responseBody !== null && existing.statusCode !== null) {
        return { value: existing.responseBody as T, replayed: true };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.idempotencyRecord.findUnique({
        where: { actorScope_idempotencyKey: { actorScope, idempotencyKey: key } },
      });

      if (locked?.responseBody !== null && locked?.responseBody !== undefined) {
        if (locked.requestHash !== hash) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: '相同 Idempotency-Key 已被不同內容使用。',
          });
        }
        return { value: locked.responseBody as T, replayed: true };
      }

      if (!locked) {
        await tx.idempotencyRecord.create({
          data: {
            actorScope,
            idempotencyKey: key,
            requestHash: hash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      const value = await work(tx);

      await tx.idempotencyRecord.update({
        where: { actorScope_idempotencyKey: { actorScope, idempotencyKey: key } },
        data: {
          statusCode: 200,
          responseBody: toJsonSafe(value) as Prisma.InputJsonValue,
        },
      });

      return { value, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return result;
  }
}
