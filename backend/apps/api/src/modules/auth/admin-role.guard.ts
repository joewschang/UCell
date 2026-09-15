import { CanActivate,ExecutionContext,ForbiddenException,Injectable,UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AdminRoleGuard implements CanActivate{
  constructor(private readonly reflector:Reflector){}

  canActivate(ctx:ExecutionContext){
    const req=ctx.switchToHttp().getRequest();
    const url=String(req.originalUrl??req.url??'');
    const isAdminApi=/(?:^|\/api\/v1)\/admin(?:\/|$)/.test(url);
    if(!isAdminApi) return true;
    if(!req.user) throw new UnauthorizedException('ADMIN_SESSION_REQUIRED');

    const allowed=this.reflector.getAllAndOverride<string[]>('roles',[ctx.getHandler(),ctx.getClass()]);
    if(!allowed?.length) throw new ForbiddenException('ROLE_POLICY_MISSING');
    if(!req.user.role || !allowed.includes(req.user.role))
      throw new ForbiddenException('ROLE_DENIED');
    return true;
  }
}
