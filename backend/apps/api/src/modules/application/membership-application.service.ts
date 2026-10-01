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

  private applicant(dto:CreateMembershipApplicationDto){
    if(dto.holderType==='PERSON'){
      if(!dto.personId||dto.legalEntityId)throw new UnprocessableEntityException({code:'MEMBERSHIP_PERSON_APPLICANT_REQUIRED'});
      return {personId:dto.personId,legalEntityId:undefined};
    }
    if(!dto.legalEntityId||dto.personId)throw new UnprocessableEntityException({code:'MEMBERSHIP_LEGAL_ENTITY_APPLICANT_REQUIRED'});
    return {personId:undefined,legalEntityId:dto.legalEntityId};
  }

  async create(dto:CreateMembershipApplicationDto,key:string,requestId:string,actorId?:string) {
    const correlationId=randomUUID(),applicant=this.applicant(dto);
    return this.idempotency.execute(`admin:membership-application:create:${actorId ?? 'system'}`,key,dto,async tx=>{
      if(dto.holderType==='PERSON'){
        const person=await tx.person.findUnique({where:{personId:applicant.personId!}});
        if(!person)throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'Person不存在。'});
      }else{
        const entity=await tx.legalEntity.findUnique({where:{legalEntityId:applicant.legalEntityId!}});
        if(!entity)throw new ConflictException({code:'RESOURCE_NOT_FOUND',message:'LegalEntity不存在。'});
        if(entity.membershipState!=='FORMAL_MEMBER'||entity.status!=='ACTIVE')throw new ConflictException({code:'LEGAL_ENTITY_FORMAL_MEMBERSHIP_REQUIRED'});
      }

      const application=await tx.membershipApplication.create({
        data:{
          ...applicant,
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
        afterData:{applicationId:application.applicationId,holderType:dto.holderType,personId:application.personId,legalEntityId:application.legalEntityId,requestedPlanLevelCode:application.requestedPlanLevelCode},
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

      if(app.legalEntityId){
        const entity=await tx.legalEntity.findUnique({where:{legalEntityId:app.legalEntityId}});
        if(!entity||entity.membershipState!=='FORMAL_MEMBER'||entity.status!=='ACTIVE')throw new ConflictException({code:'LEGAL_ENTITY_FORMAL_MEMBERSHIP_REQUIRED'});
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
      if((app.personId?1:0)+(app.legalEntityId?1:0)!==1)throw new ConflictException({code:'MEMBERSHIP_APPLICANT_INVALID'});
      if(app.legalEntityId){
        const entity=await tx.legalEntity.findUnique({where:{legalEntityId:app.legalEntityId}});
        if(!entity||entity.membershipState!=='FORMAL_MEMBER'||entity.status!=='ACTIVE')throw new ConflictException({code:'LEGAL_ENTITY_FORMAL_MEMBERSHIP_REQUIRED'});
      }

      const sponsorSequenceNo=await this.organization.allocateSponsorSequence(tx,app.sponsorQualificationId);
      const side=app.binarySide as SideCode;
      await this.organization.assertBinarySlotAvailable(tx,app.binaryParentQualificationId,side);
      await this.organization.assertFirstThirdLeftRule(tx,app.sponsorQualificationId,sponsorSequenceNo,app.binaryParentQualificationId,side);

      const effectiveAt=new Date();
      const qualification=await tx.qualification.create({
        data:{
          currentHolderPersonId:app.personId,
          currentHolderLegalEntityId:app.legalEntityId,
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
          planCode:app.requestedPlanLevelCode,
          effectiveFrom:effectiveAt,
          sourceType:'INITIAL_PLAN',
          sourceId:applicationId
        }
      });

      await tx.qualificationHolderHistory.create({
        data:{
          qualificationId:qualification.qualificationId,
          holderPersonId:app.personId,
          holderLegalEntityId:app.legalEntityId,
          effectiveFrom:effectiveAt,
          sourceType:'MEMBERSHIP_APPLICATION',
          sourceId:applicationId
        }
      });

      await tx.qualificationOwnerInterval.create({
        data:{
          qualificationId:qualification.qualificationId,
          ownerType:app.legalEntityId?'LEGAL_ENTITY':'MEMBER',
          personId:app.personId,
          legalEntityId:app.legalEntityId,
          companyPrincipalId:null,
          effectiveFrom:effectiveAt,
          sourceType:'MEMBERSHIP_APPLICATION',
          sourceId:applicationId,
          evidenceHash:createHash('sha256').update(JSON.stringify({applicationId,personId:app.personId,legalEntityId:app.legalEntityId,effectiveAt:effectiveAt.toISOString()})).digest('hex')
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

      await this.organization.createBinaryPlacement(tx,{
        parentQualificationId:app.binaryParentQualificationId,childQualificationId:qualification.qualificationId,side,effectiveFrom:effectiveAt
      },{sourceType:'MEMBERSHIP_APPLICATION_APPROVAL',actorId,correlationId,reason:'Approved application placement'});

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
          applicationId:updated.applicationId,
          qualificationId:qualification.qualificationId,
          holderType:app.legalEntityId?'LEGAL_ENTITY':'PERSON',
          personId:app.personId,
          legalEntityId:app.legalEntityId,
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
            {person:{memberNo:{contains:q}}},
            {legalEntity:{registeredName:{contains:q,mode:'insensitive'}}},
            {legalEntity:{memberNo:{contains:q}}},
            {legalEntity:{registrationNo:{contains:q,mode:'insensitive'}}},
          ]
        }:{})
      },
      include:{person:true,legalEntity:true,qualification:true},
      orderBy:{createdAt:'desc'},
      take,
    });
  }

  async get(applicationId:string){
    const app=await this.prisma.membershipApplication.findUniqueOrThrow({
      where:{applicationId},
      include:{person:true,legalEntity:true,qualification:true}
    });

    const ids=[app.sponsorQualificationId,app.binaryParentQualificationId].filter(Boolean) as string[];
    const related=ids.length?await this.prisma.qualification.findMany({
      where:{qualificationId:{in:ids}},
      include:{currentHolder:true,currentHolderLegalEntity:true}
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
