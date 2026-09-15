import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { IdentityTokenService } from './identity-token.service';
import { LineIdentityService } from './line-identity.service';
import { authenticateMemberRequest, MemberAuthenticationError } from './member-authentication';

@Injectable()
export class MemberAuthenticationGuard implements CanActivate {
  constructor(
    private readonly tokens: IdentityTokenService,
    private readonly identities: LineIdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      await authenticateMemberRequest(request, {
        authenticate: token => this.tokens.authenticate(token),
        resolveLineSubject: lineSubject => this.identities.resolveVerifiedSubject({ lineSubject }),
      });
      return true;
    } catch (error) {
      if (error instanceof MemberAuthenticationError && error.message === 'MEMBER_IDENTITY_UNAVAILABLE') {
        throw new ServiceUnavailableException(error.message);
      }
      throw new UnauthorizedException(error instanceof MemberAuthenticationError
        ? error.message : 'MEMBER_SESSION_INVALID');
    }
  }
}
