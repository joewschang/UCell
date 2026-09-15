import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      await authenticateMemberRequest(request, {
        authenticate: token => this.tokens.authenticate(token),
        resolveLineSubject: lineSubject => this.identities.resolveVerifiedSubject({ lineSubject }),
      });
      const person=await this.db.person.findUnique({where:{personId:request.user.personId}});
      if(!person||person.status!=='EFFECTIVE')throw new MemberAuthenticationError('MEMBER_PERSON_DISABLED');
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
