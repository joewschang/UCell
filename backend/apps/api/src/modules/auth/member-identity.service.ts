import { Injectable,UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

export type MemberAuthProvider='LINE'|'GOOGLE'|'MEMBER_LOCAL'|'SMS_OTP';

@Injectable()
export class MemberIdentityService{
  constructor(private readonly db:PrismaService){}

  async resolve(input:{provider:MemberAuthProvider;subject:string;personId:string}){
    if(!input.subject||!input.personId)throw new UnauthorizedException('MEMBER_IDENTITY_REQUIRED');

    if(input.provider==='MEMBER_LOCAL'){
      const person=await this.db.person.findUnique({where:{personId:input.personId},select:{personId:true,memberNo:true,status:true}});
      if(!person||person.status!=='EFFECTIVE'||person.memberNo!==input.subject)throw new UnauthorizedException('MEMBER_IDENTITY_MISMATCH');
      return {provider:'MEMBER_LOCAL' as const,providerSubject:person.memberNo,personId:person.personId};
    }

    if(input.provider==='SMS_OTP'){
      const person=await this.db.person.findUnique({where:{personId:input.personId},select:{personId:true,mobile:true,mobileVerifiedAt:true,status:true}});
      if(!person||person.status!=='EFFECTIVE'||!person.mobileVerifiedAt||person.mobile!==input.subject)throw new UnauthorizedException('MEMBER_IDENTITY_MISMATCH');
      return {provider:'SMS_OTP' as const,providerSubject:person.mobile,personId:person.personId};
    }

    const link=await this.db.identityLink.findUnique({where:{provider_providerSubject:{provider:input.provider,providerSubject:input.subject}}});
    if(!link||link.personId!==input.personId)throw new UnauthorizedException('MEMBER_IDENTITY_MISMATCH');
    return {provider:input.provider,providerSubject:link.providerSubject,personId:link.personId};
  }
}
