import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
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
