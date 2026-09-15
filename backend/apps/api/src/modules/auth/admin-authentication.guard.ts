import { CanActivate,ExecutionContext,Injectable,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityTokenService } from './identity-token.service';

@Injectable()
export class AdminAuthenticationGuard implements CanActivate{
  constructor(private readonly tokens:IdentityTokenService,private readonly config:ConfigService){}

  async canActivate(ctx:ExecutionContext){
    const req=ctx.switchToHttp().getRequest();
    const url=String(req.originalUrl ?? req.url ?? '');
    const isAdminApi=/(?:^|\/api\/v1)\/admin(?:\/|$)/.test(url);
    if(!isAdminApi) return true;

    const bypass=this.config.get<string>('ADMIN_AUTH_BYPASS')==='true';
    const env=this.config.get<string>('NODE_ENV') ?? 'development';
    if(bypass && env!=='production'){
      req.user=req.user ?? {
        sessionId:'DEV_BYPASS',personId:undefined,provider:'ADMIN_LOCAL',
        subject:'dev-bypass',role:'SUPER_ADMIN'
      };
      return true;
    }

    const auth=String(req.headers?.authorization??'');
    if(!auth.startsWith('Bearer ')) throw new UnauthorizedException('ADMIN_BEARER_REQUIRED');
    req.user=await this.tokens.authenticate(auth.slice(7));
    if(!req.user?.role) throw new UnauthorizedException('ADMIN_ROLE_REQUIRED');
    return true;
  }
}
