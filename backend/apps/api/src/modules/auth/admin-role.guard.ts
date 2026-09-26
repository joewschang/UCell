import { CanActivate,ExecutionContext,ForbiddenException,Injectable,Optional,UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class AdminRoleGuard implements CanActivate{
  constructor(private readonly reflector:Reflector,@Optional() private readonly prisma?:PrismaService,@Optional() private readonly audit?:AuditService){}
  private denied(req:any,code:string){if(!this.prisma||!this.audit)return;const correlationId=req.correlationId??randomUUID();void this.prisma.$transaction(tx=>this.audit!.write(tx,{actorType:req.user?.personId?'USER':'SYSTEM',actorId:req.user?.personId,actorRoleSnapshot:req.user?.role,action:'ACCESS_DENIED',eventCode:'ACCESS_DENIED',entityType:'AdminAuthorization',afterData:{path:String(req.originalUrl??req.url??'').split('?')[0],code},reasonCode:code,result:'DENIED',severity:'WARNING',requestId:req.requestId??randomUUID(),correlationId})).catch(()=>undefined);}
  canActivate(ctx:ExecutionContext){
    const req=ctx.switchToHttp().getRequest(),url=String(req.originalUrl??req.url??'');if(!/(?:^|\/api\/v1)\/admin(?:\/|$)/.test(url)) return true;
    if(!req.user){this.denied(req,'ADMIN_SESSION_REQUIRED');throw new UnauthorizedException('ADMIN_SESSION_REQUIRED');}const allowed=this.reflector.getAllAndOverride<string[]>('roles',[ctx.getHandler(),ctx.getClass()]);
    if(!allowed?.length){this.denied(req,'ROLE_POLICY_MISSING');throw new ForbiddenException('ROLE_POLICY_MISSING');}if(!req.user.role || !allowed.includes(req.user.role)){this.denied(req,'ROLE_DENIED');throw new ForbiddenException('ROLE_DENIED');}return true;
  }
}
