import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService, SideCode } from '@ucell/database';
import { randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { OrganizationService } from '../organization/organization.service';
import { CreateQualificationDto } from './dto/create-qualification.dto';

@Injectable()
export class QualificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly organization: OrganizationService,
  ) {}

  async create(dto: CreateQualificationDto, key: string, requestId: string, actorId?: string) {
    const correlationId = randomUUID();
    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();

    return this.idempotency.execute(`admin:qualification:create:${actorId ?? 'system'}`, key, dto, async (tx) => {
      const [person, sponsor, binaryParent] = await Promise.all([
        tx.person.findUnique({ where: { personId: dto.personId } }),
        tx.qualification.findUnique({ where: { qualificationId: dto.sponsorQualificationId } }),
        tx.qualification.findUnique({ where: { qualificationId: dto.binaryParentQualificationId } }),
      ]);

      if (!person) {
        throw new ConflictException({ code: 'RESOURCE_NOT_FOUND', message: 'Person不存在。' });
      }
      if (!sponsor) {
        throw new ConflictException({ code: 'RESOURCE_NOT_FOUND', message: 'Sponsor Qualification不存在。' });
      }
      if (!binaryParent) {
        throw new ConflictException({ code: 'RESOURCE_NOT_FOUND', message: 'Binary Parent不存在。' });
      }

      const sponsorSequenceNo = await this.organization.allocateSponsorSequence(tx, dto.sponsorQualificationId);
      const side = dto.binarySide as SideCode;

      await this.organization.assertBinarySlotAvailable(tx, dto.binaryParentQualificationId, side);
      await this.organization.assertFirstThirdLeftRule(
        tx,
        dto.sponsorQualificationId,
        sponsorSequenceNo,
        dto.binaryParentQualificationId,
        side,
      );

      const qualification = await tx.qualification.create({
        data: {
          currentHolderPersonId: dto.personId,
          planLevelCode: dto.planLevelCode,
          status: 'EFFECTIVE',
          activeFlag: false,
          effectiveAt,
        },
      });

      await this.organization.assertNoBinaryCycle(
        tx,
        qualification.qualificationId,
        dto.binaryParentQualificationId,
      );

      await tx.qualificationPlanHistory.create({
        data:{
          qualificationId:qualification.qualificationId,
          planCode:qualification.planLevelCode,
          effectiveFrom:effectiveAt,
          sourceType:'INITIAL_PLAN',
          sourceId:undefined
        }
      });

      await tx.qualificationHolderHistory.create({
        data: {
          qualificationId: qualification.qualificationId,
          holderPersonId: dto.personId,
          effectiveFrom: effectiveAt,
          sourceType: 'INITIAL_APPLICATION',
        },
      });

      await tx.sponsorRelationship.create({
        data: {
          sponsorQualificationId: dto.sponsorQualificationId,
          childQualificationId: qualification.qualificationId,
          sponsorSequenceNo,
          effectiveFrom: effectiveAt,
        },
      });

      await tx.binaryPlacement.create({
        data: {
          parentQualificationId: dto.binaryParentQualificationId,
          childQualificationId: qualification.qualificationId,
          side,
          effectiveFrom: effectiveAt,
        },
      });

      await this.audit.write(tx, {
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId,
        action: 'QUALIFICATION_CREATED',
        entityType: 'QUALIFICATION',
        entityId: qualification.qualificationId,
        afterData: {
          qualification,
          sponsorQualificationId: dto.sponsorQualificationId,
          sponsorSequenceNo,
          binaryParentQualificationId: dto.binaryParentQualificationId,
          binarySide: side,
        },
        requestId,
        correlationId,
      });

      return {
        qualification,
        sponsor: {
          sponsorQualificationId: dto.sponsorQualificationId,
          sponsorSequenceNo,
        },
        binary: {
          parentQualificationId: dto.binaryParentQualificationId,
          side,
        },
      };
    });
  }


  async search(input:{q?:string;status?:string;take?:number}={}){
    const take=Math.min(Math.max(input.take ?? 50,1),100);
    const q=input.q?.trim();

    return this.prisma.qualification.findMany({
      where:{
        ...(input.status?{status:input.status as any}:{}),
        ...(q?{
          OR:[
            {qualificationId:q.match(/^[0-9a-f-]{36}$/i)?q:undefined},
            {currentHolder:{legalName:{contains:q,mode:'insensitive'}}},
            {currentHolder:{preferredName:{contains:q,mode:'insensitive'}}},
            {currentHolder:{mobile:{contains:q}}},
            {currentHolder:{email:{contains:q,mode:'insensitive'}}},
          ].filter(Boolean) as any
        }:{})
      },
      include:{
        currentHolder:true,
        sponsorRelation:{include:{sponsor:{include:{currentHolder:true}}}},
        binaryPlacement:{include:{parent:{include:{currentHolder:true}}}},
      },
      orderBy:{createdAt:'desc'},
      take,
    });
  }

  async get(qualificationId: string) {
    return this.prisma.qualification.findUniqueOrThrow({
      where: { qualificationId },
      include: {
        currentHolder: true,
        sponsorRelation:{include:{sponsor:{include:{currentHolder:true}}}},
        binaryPlacement:{include:{parent:{include:{currentHolder:true}}}},
        holderHistory:{orderBy:{effectiveFrom:'desc'},take:20},
        qualificationStatusHistory:{orderBy:{effectiveFrom:'desc'},take:20},
        activePeriods:{orderBy:{activeFrom:'desc'},take:20},
        orders:{orderBy:{createdAt:'desc'},take:10},
      },
    });
  }
}
