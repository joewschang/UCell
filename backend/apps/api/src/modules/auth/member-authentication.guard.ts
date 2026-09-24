import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { IdentityTokenService } from './identity-token.service';
import { PrismaService } from '@ucell/database';
import { LineIdentityService } from './line-identity.service';
import { authenticateMemberRequest, MemberAuthenticationError } from './member-authentication';

@Injectable()
export class MemberAuthenticationGuard implements CanActivate {
  constructor(
    private readonly tokens: IdentityTokenService,
    private readonly identities: LineIdentityService,
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const stageToken=this.config.get<string>('STAGE_UAT_MEMBER_TOKEN');
    const stageUat=this.config.get<string>('UCELL_ENVIRONMENT')==='STAGE' && this.config.get<string>('NODE_ENV')==='staging' && !!stageToken;
    const bearer=typeof request.headers?.authorization==='string' ? request.headers.authorization : '';
    if(stageUat && bearer.startsWith('Bearer ')){
      const supplied=bearer.slice(7);
      const expected=Buffer.from(stageToken!); const actual=Buffer.from(supplied);
      if(expected.length===actual.length && timingSafeEqual(expected,actual)){
        const person=await this.db.person.findUnique({where:{personId:'51000000-0000-4000-8000-000000000001'}});
        if(!person||person.status!=='EFFECTIVE'||person.securityStatus!=='NORMAL')throw new UnauthorizedException('STAGE_UAT_MEMBER_UNAVAILABLE');
        request.user={sessionId:'STAGE_UAT_MEMBER',personId:person.personId,provider:'LINE',subject:'stage-uat-member'};
        return true;
      }
    }
    try {
      await authenticateMemberRequest(request, {
        authenticate: token => this.tokens.authenticate(token),
        resolveLineSubject: lineSubject => this.identities.resolveVerifiedSubject({ lineSubject }),
      });
      const person=await this.db.person.findUnique({where:{personId:request.user.personId}});
      if(!person||person.status!=='EFFECTIVE')throw new MemberAuthenticationError('MEMBER_PERSON_DISABLED');
      if(person.securityStatus!=='NORMAL')throw new MemberAuthenticationError('MEMBER_SECURITY_LOCKED');
      return true;
    } catch (error) {
      delete request.user;
      if (error instanceof MemberAuthenticationError && error.message === 'MEMBER_IDENTITY_UNAVAILABLE') {
        throw new ServiceUnavailableException(error.message);
      }
      throw new UnauthorizedException(error instanceof MemberAuthenticationError
        ? error.message : 'MEMBER_SESSION_INVALID');
    }
  }
}
