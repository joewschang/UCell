import {Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';

export type CrossLineConflictResult={
  applicationId:string;
  status:'CLEAR'|'MANUAL_REVIEW_REQUIRED'|'BLOCKED';
  codes:string[];
};

@Injectable()
export class FormalMembershipConflictService {
  constructor(private readonly db:PrismaService){}

  async evaluate(applicationId:string):Promise<CrossLineConflictResult>{
    const application=await this.db.formalMemberApplication.findUnique({
      where:{formalMemberApplicationId:applicationId},
      include:{person:true,legalEntity:true},
    });
    if(!application)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});

    const codes:string[]=[];
    const applicantFingerprint=application.applicantIdentityFingerprint;
    const spouseFingerprint=application.spouseIdentityFingerprint;

    if(application.person.membershipState==='FORMAL_MEMBER'){
      codes.push(application.applicantType==='LEGAL_ENTITY'?'REPRESENTATIVE_ALREADY_FORMAL':'APPLICANT_ALREADY_FORMAL');
    }

    if(applicantFingerprint){
      const owner=await this.db.formalIdentityIndex.findUnique({where:{nationalIdFingerprint:applicantFingerprint}});
      if(owner&&owner.personId!==application.personId)codes.push('IDENTITY_ALREADY_HELD_BY_OTHER_FORMAL_MEMBER');

      const spouseOfFormal=await this.db.spouseRelationship.findFirst({
        where:{
          spouseIdentityFingerprint:applicantFingerprint,
          verificationStatus:'VERIFIED',
          effectiveTo:null,
          person:{membershipState:'FORMAL_MEMBER'},
        },
        select:{personId:true},
      });
      if(spouseOfFormal&&spouseOfFormal.personId!==application.personId)codes.push('APPLICANT_IS_VERIFIED_SPOUSE_OF_FORMAL_MEMBER');
    }

    if(spouseFingerprint){
      const spouseFormal=await this.db.formalIdentityIndex.findUnique({where:{nationalIdFingerprint:spouseFingerprint}});
      if(spouseFormal&&spouseFormal.personId!==application.personId)codes.push('SPOUSE_ALREADY_FORMAL_MEMBER');
    }

    if(application.applicantType==='LEGAL_ENTITY'){
      const registrationNo=application.legalEntityRegistrationNo;
      if(registrationNo){
        const existingEntity=await this.db.legalEntity.findUnique({where:{registrationNo}});
        if(existingEntity?.membershipState==='FORMAL_MEMBER'&&existingEntity.legalEntityId!==application.legalEntityId)codes.push('LEGAL_ENTITY_ALREADY_FORMAL');
      }
      const otherControlled=await this.db.legalEntityRepresentative.findFirst({
        where:{
          personId:application.personId,
          effectiveTo:null,
          legalEntity:{membershipState:'FORMAL_MEMBER'},
          ...(application.legalEntityId?{legalEntityId:{not:application.legalEntityId}}:{}),
        },
        select:{legalEntityId:true},
      });
      if(otherControlled)codes.push('REPRESENTATIVE_CONTROLS_OTHER_FORMAL_ENTITY');
    }

    const unique=[...new Set(codes)];
    const status=unique.length?'BLOCKED':'CLEAR';
    return {applicationId,status,codes:unique};
  }
}
