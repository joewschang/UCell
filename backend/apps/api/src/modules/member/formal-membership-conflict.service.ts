import {Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {randomUUID} from 'node:crypto';

export type CrossLineConflictResult={
  applicationId:string;
  status:'CLEAR'|'MANUAL_REVIEW_REQUIRED'|'BLOCKED';
  codes:string[];
};

@Injectable()
export class FormalMembershipConflictService {
  constructor(private readonly db:PrismaService,private readonly audit?:AuditService){}

  async evaluate(applicationId:string,at=new Date()):Promise<CrossLineConflictResult>{
    const application=await this.db.formalMemberApplication.findUnique({
      where:{formalMemberApplicationId:applicationId},
      include:{person:true,legalEntity:true},
    });
    if(!application)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});

    const codes:string[]=[];
    const applicantFingerprint=application.applicantIdentityFingerprint;
    const spouseFingerprint=application.spouseIdentityFingerprint;
    const activeRepresentation={
      roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',effectiveFrom:{lte:at},
      OR:[{effectiveTo:null},{effectiveTo:{gt:at}}],
      legalEntity:{membershipState:'FORMAL_MEMBER' as const},
    };
    const operatingPerson={OR:[
      {membershipState:'FORMAL_MEMBER' as const},
      {legalEntityRepresentations:{some:activeRepresentation}},
    ]};

    if(application.person.membershipState==='FORMAL_MEMBER'){
      codes.push(application.applicantType==='LEGAL_ENTITY'?'REPRESENTATIVE_ALREADY_FORMAL':'APPLICANT_ALREADY_FORMAL');
    }

    if(applicantFingerprint){
      const owner=await this.db.formalIdentityIndex.findUnique({where:{identityDocumentFingerprint:applicantFingerprint}});
      if(owner&&owner.personId!==application.personId)codes.push('IDENTITY_ALREADY_HELD_BY_OTHER_FORMAL_MEMBER');

      const spouseOfFormal=await this.db.spouseRelationship.findFirst({
        where:{
          spouseIdentityFingerprint:applicantFingerprint,
          verificationStatus:'VERIFIED',
          effectiveFrom:{lte:at},
          OR:[{effectiveTo:null},{effectiveTo:{gt:at}}],
          person:operatingPerson,
        },
        select:{personId:true},
      });
      if(spouseOfFormal&&spouseOfFormal.personId!==application.personId)codes.push('APPLICANT_IS_VERIFIED_SPOUSE_OF_FORMAL_MEMBER');
    }

    if(spouseFingerprint){
      const spouseFormal=await this.db.formalIdentityIndex.findUnique({where:{identityDocumentFingerprint:spouseFingerprint}});
      if(spouseFormal&&spouseFormal.personId!==application.personId)codes.push('SPOUSE_ALREADY_FORMAL_MEMBER');
    }

    // Representation is an operating right even when the Person remains a
    // NETWORK_MEMBER. Check the reverse direction for individual applications.
    const otherControlled=await this.db.legalEntityRepresentative.findFirst({
      where:{personId:application.personId,...activeRepresentation,
        ...(application.applicantType==='LEGAL_ENTITY'&&application.legalEntityId?{legalEntityId:{not:application.legalEntityId}}:{}),
      },select:{legalEntityId:true},
    });
    if(otherControlled)codes.push('REPRESENTATIVE_CONTROLS_OTHER_FORMAL_ENTITY');

    if(application.applicantType==='LEGAL_ENTITY'){
      const registrationNo=application.legalEntityRegistrationNo;
      if(registrationNo){
        const existingEntity=await this.db.legalEntity.findUnique({where:{registrationNo}});
        if(existingEntity?.membershipState==='FORMAL_MEMBER')codes.push('LEGAL_ENTITY_ALREADY_FORMAL');
      }
    }

    const unique=[...new Set(codes)];
    const status=unique.length?'BLOCKED':'CLEAR';
    return {applicationId,status,codes:unique};
  }
  async review(applicationId:string,actorId:string,requestId:string){
    const result=await this.evaluate(applicationId);
    if(!actorId)throw new NotFoundException({code:'ADMIN_PERSON_ID_REQUIRED'});
    const correlationId=randomUUID();
    await this.db.$transaction(async tx=>{
      await tx.formalMemberApplication.update({where:{formalMemberApplicationId:applicationId},data:{
        crossLineReviewStatus:result.status,
        crossLineConflictCode:result.codes[0]??null,
      }});
      if(this.audit)await this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_CROSS_LINE_REVIEW',entityType:'FormalMemberApplication',entityId:applicationId,afterData:{status:result.status,codes:result.codes},requestId,correlationId});
    });
    return result;
  }
}
