import { CanActivate,ExecutionContext,Injectable,UnauthorizedException } from '@nestjs/common';
import { IdentityTokenService } from './identity-token.service';
@Injectable()
export class AuthenticationGuard implements CanActivate{
  constructor(private readonly tokens:IdentityTokenService){}
  async canActivate(ctx:ExecutionContext){
    const req=ctx.switchToHttp().getRequest();
    const auth=String(req.headers?.authorization??'');
    if(!auth.startsWith('Bearer ')) throw new UnauthorizedException('BEARER_REQUIRED');
    req.user=await this.tokens.authenticate(auth.slice(7)); return true;
  }
}
