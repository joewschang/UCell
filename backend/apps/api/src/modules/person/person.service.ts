import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { CreatePersonDto } from './dto/create-person.dto';

@Injectable()
export class PersonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreatePersonDto, key: string, requestId: string, actorId?: string) {
    const correlationId = randomUUID();
    return this.idempotency.execute(`admin:person:create:${actorId ?? 'system'}`, key, dto, async (tx) => {
      const person = await tx.person.create({
        data: {
          legalName: dto.legalName,
          preferredName: dto.preferredName,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          mobile: dto.mobile,
          email: dto.email,
          status: 'DRAFT',
        },
      });

      await this.audit.write(tx, {
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId,
        action: 'PERSON_CREATED',
        entityType: 'PERSON',
        entityId: person.personId,
        afterData: person,
        requestId,
        correlationId,
      });

      return person;
    });
  }

  async get(personId: string) {
    return this.prisma.person.findUniqueOrThrow({ where: { personId } });
  }

  /** Current holder read model only; historical entitlement never uses this query. */
  async qualifications(personId: string, take = 20, skip = 0) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(personId)) {
      throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'personId must be a UUID' });
    }
    if (!Number.isSafeInteger(take) || take < 1 || take > 100 || !Number.isSafeInteger(skip) || skip < 0) {
      throw new UnprocessableEntityException({ code: 'VALIDATION_ERROR', message: 'take must be 1..100 and skip a nonnegative safe integer' });
    }
    return this.prisma.$transaction(async tx => {
      const person = await tx.person.findUnique({ where: { personId }, select: { personId: true } });
      if (!person) throw new NotFoundException({ code: 'PERSON_NOT_FOUND' });
      const where = { currentHolderPersonId: personId };
      const total = await tx.qualification.count({ where });
      const data = await tx.qualification.findMany({
        where, take, skip, orderBy: [{ createdAt: 'desc' }, { qualificationId: 'asc' }],
      });
      return { data, meta: { total, take, skip } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async search(query?: string, take = 20) {
    return this.prisma.person.findMany({
      where: query ? {
        OR: [
          { legalName: { contains: query, mode: 'insensitive' } },
          { preferredName: { contains: query, mode: 'insensitive' } },
          { mobile: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      } : undefined,
      take: Math.min(Math.max(take, 1), 100),
      orderBy: { createdAt: 'desc' },
    });
  }
}
