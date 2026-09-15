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

    // Controllers historically passed an absent userId, producing :system scopes.
    // Preserve those committed responses when the corrected personId is supplied.
    const legacyMatch = actorScope.match(/^(admin:(?:person|qualification|membership-application|subscription):create):[0-9a-f-]{36}$/i);
    const scopes = legacyMatch ? [actorScope, `${legacyMatch[1]}:system`] : [actorScope];
    const lookup = async (client: Prisma.TransactionClient | PrismaService) => {
      for (const scope of scopes) {
        const record = await client.idempotencyRecord.findUnique({
          where: { actorScope_idempotencyKey: { actorScope: scope, idempotencyKey: key } },
        });
        if (record) return record;
      }
      return null;
    };

    const existing = await lookup(this.prisma);

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
      const locked = await lookup(tx);

      if (locked && locked.requestHash !== hash) {
        throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: '相同 Idempotency-Key 已被不同內容使用。' });
      }

      if (locked?.responseBody !== null && locked?.responseBody !== undefined) {
        if (locked.requestHash !== hash) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: '相同 Idempotency-Key 已被不同內容使用。',
          });
        }
        return { value: locked.responseBody as T, replayed: true };
      }
      if (locked && locked.actorScope !== actorScope) {
        throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Legacy idempotency operation has no committed response; reconcile before retry.' });
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
