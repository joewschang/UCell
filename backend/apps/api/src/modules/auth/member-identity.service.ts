import { Injectable,UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';

export type MemberAuthProvider='LINE'|'GOOGLE'|'MEMBER_LOCAL';

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

    const link=await this.db.identityLink.findUnique({where:{provider_providerSubject:{provider:input.provider,providerSubject:input.subject}}});
    if(!link||link.personId!==input.personId)throw new UnauthorizedException('MEMBER_IDENTITY_MISMATCH');
    return {provider:input.provider,providerSubject:link.providerSubject,personId:link.personId};
  }
}
