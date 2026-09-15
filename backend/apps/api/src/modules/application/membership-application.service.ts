import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService, SideCode } from '@ucell/database';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { OrganizationService } from '../organization/organization.service';
import { CreateMembershipApplicationDto } from './dto/create-membership-application.dto';

@Injectable()
export class MembershipApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly organization: OrganizationService,
  ) {}

  async create(dto:CreateMembershipApplicationDto,key:string,requestId:string,actorId?:string) {
    const correlationId=randomUUID();
    return this.idempotency.execute(`admin:membership-application:create:${actorId ?? 'system'}`,key,dto,async tx=>{
      const person=await tx.person.findUnique({where:{personId:dto.personId}});
      if(!person) throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'Person不存在。'});

      const application=await tx.membershipApplication.create({
        data:{
          personId:dto.personId,
          requestedPlanLevelCode:dto.requestedPlanLevelCode,
          sponsorQualificationId:dto.sponsorQualificationId,
          binaryParentQualificationId:dto.binaryParentQualificationId,
          binarySide:dto.binarySide,
          status:'DRAFT',
          sourceReferralTokenHash:dto.sourceReferralToken
            ? createHash('sha256').update(dto.sourceReferralToken).digest('hex')
            : undefined,
          note:dto.note,
        }
      });

      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'MEMBERSHIP_APPLICATION_CREATED',
        entityType:'MEMBERSHIP_APPLICATION',
        entityId:application.applicationId,
        afterData:application,
        requestId,correlationId
      });
      return application;
    });
  }

  async submit(applicationId:string,key:string,requestId:string,actorId?:string) {
    const correlationId=randomUUID();
    return this.idempotency.execute(`admin:membership-application:submit:${applicationId}`,key,{applicationId},async tx=>{
      const app=await tx.membershipApplication.findUnique({where:{applicationId}});
      if(!app) throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'申請不存在。'});
      if(app.status!=='DRAFT') throw new ConflictException({code:'INVALID_STATE',message:'只有DRAFT可提交。'});

      if(!app.sponsorQualificationId || !app.binaryParentQualificationId || !app.binarySide){
        throw new UnprocessableEntityException({
          code:'DOMAIN_RULE_VIOLATION',
          message:'提交前必須完成Sponsor與Binary安置資料。'
        });
      }

      const updated=await tx.membershipApplication.update({
        where:{applicationId},
        data:{status:'SUBMITTED',submittedAt:new Date()}
      });

      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'MEMBERSHIP_APPLICATION_SUBMITTED',
        entityType:'MEMBERSHIP_APPLICATION',entityId:applicationId,
        beforeData:app,afterData:updated,requestId,correlationId
      });
      return updated;
    });
  }

  async approve(applicationId:string,key:string,requestId:string,actorId?:string) {
    const correlationId=randomUUID();
    return this.idempotency.execute(`admin:membership-application:approve:${applicationId}`,key,{applicationId},async tx=>{
      const app=await tx.membershipApplication.findUnique({where:{applicationId}});
      if(!app) throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'申請不存在。'});
      if(app.status!=='SUBMITTED') throw new ConflictException({code:'INVALID_STATE',message:'只有SUBMITTED可核准。'});
      if(!app.sponsorQualificationId || !app.binaryParentQualificationId || !app.binarySide){
        throw new UnprocessableEntityException({code:'DOMAIN_RULE_VIOLATION',message:'組織資料未完整。'});
      }

      const sponsorSequenceNo=await this.organization.allocateSponsorSequence(tx,app.sponsorQualificationId);
      const side=app.binarySide as SideCode;
      await this.organization.assertBinarySlotAvailable(tx,app.binaryParentQualificationId,side);
      await this.organization.assertFirstThirdLeftRule(tx,app.sponsorQualificationId,sponsorSequenceNo,app.binaryParentQualificationId,side);

      const effectiveAt=new Date();
      const qualification=await tx.qualification.create({
        data:{
          currentHolderPersonId:app.personId,
          planLevelCode:app.requestedPlanLevelCode,
          status:'EFFECTIVE',
          activeFlag:false,
          effectiveAt
        }
      });

      await this.organization.assertNoBinaryCycle(tx,qualification.qualificationId,app.binaryParentQualificationId);

      await tx.qualificationPlanHistory.create({
        data:{
          qualificationId:qualification.qualificationId,
          planCode:qualification.planLevelCode,
          effectiveFrom:effectiveAt,
          sourceType:'INITIAL_PLAN',
          sourceId:applicationId
        }
      });

      await tx.qualificationHolderHistory.create({
        data:{
          qualificationId:qualification.qualificationId,
          holderPersonId:app.personId,
          effectiveFrom:effectiveAt,
          sourceType:'MEMBERSHIP_APPLICATION',
          sourceId:applicationId
        }
      });

      await tx.qualificationStatusHistory.create({
        data:{
          qualificationId:qualification.qualificationId,
          status:'EFFECTIVE',
          effectiveFrom:effectiveAt,
          sourceType:'MEMBERSHIP_APPLICATION',
          sourceId:applicationId
        }
      });

      await tx.sponsorRelationship.create({
        data:{
          sponsorQualificationId:app.sponsorQualificationId,
          childQualificationId:qualification.qualificationId,
          sponsorSequenceNo,
          effectiveFrom:effectiveAt
        }
      });

      await tx.binaryPlacement.create({
        data:{
          parentQualificationId:app.binaryParentQualificationId,
          childQualificationId:qualification.qualificationId,
          side,
          effectiveFrom:effectiveAt
        }
      });

      const updated=await tx.membershipApplication.update({
        where:{applicationId},
        data:{
          status:'EFFECTIVE',
          approvedAt:effectiveAt,
          approvedBy:actorId,
          effectiveAt,
          createdQualificationId:qualification.qualificationId
        }
      });

      await this.audit.write(tx,{
        actorType:actorId?'USER':'SYSTEM',actorId,
        action:'MEMBERSHIP_APPLICATION_APPROVED_EFFECTIVE',
        entityType:'MEMBERSHIP_APPLICATION',entityId:applicationId,
        beforeData:app,
        afterData:{
          application:updated,
          qualificationId:qualification.qualificationId,
          sponsorSequenceNo,
          binaryParentQualificationId:app.binaryParentQualificationId,
          binarySide:side
        },
        requestId,correlationId
      });

      return {application:updated,qualification};
    });
  }


  async search(input:{status?:string;q?:string;take?:number}={}){
    const take=Math.min(Math.max(input.take ?? 50,1),100);
    const q=input.q?.trim();

    return this.prisma.membershipApplication.findMany({
      where:{
        ...(input.status?{status:input.status as any}:{}),
        ...(q?{
          OR:[
            {person:{legalName:{contains:q,mode:'insensitive'}}},
            {person:{preferredName:{contains:q,mode:'insensitive'}}},
            {person:{mobile:{contains:q}}},
            {person:{email:{contains:q,mode:'insensitive'}}},
          ]
        }:{})
      },
      include:{
        person:true,
        qualification:true,
      },
      orderBy:{createdAt:'desc'},
      take,
    });
  }

  async get(applicationId:string){
    const app=await this.prisma.membershipApplication.findUniqueOrThrow({
      where:{applicationId},
      include:{person:true,qualification:true}
    });

    const ids=[app.sponsorQualificationId,app.binaryParentQualificationId].filter(Boolean) as string[];
    const related=ids.length?await this.prisma.qualification.findMany({
      where:{qualificationId:{in:ids}},
      include:{currentHolder:true}
    }):[];

    return {
      ...app,
      sponsorQualification:app.sponsorQualificationId
        ? related.find(x=>x.qualificationId===app.sponsorQualificationId) ?? null
        : null,
      binaryParentQualification:app.binaryParentQualificationId
        ? related.find(x=>x.qualificationId===app.binaryParentQualificationId) ?? null
        : null,
    };
  }
}
