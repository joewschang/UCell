import { CanActivate,ExecutionContext,Injectable,Optional,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdentityTokenService } from './identity-token.service';

@Injectable()
export class AdminAuthenticationGuard implements CanActivate{
  constructor(private readonly tokens:IdentityTokenService,private readonly config:ConfigService,@Optional() private readonly prisma?:PrismaService,@Optional() private readonly audit?:AuditService){}
  private async denied(req:any,code:string){if(!this.prisma||!this.audit)return;try{const correlationId=req.correlationId??randomUUID();await this.prisma.$transaction(tx=>this.audit!.write(tx,{actorType:'SYSTEM',action:'ACCESS_DENIED',eventCode:'ACCESS_DENIED',entityType:'AdminAuthentication',afterData:{path:String(req.originalUrl??req.url??'').split('?')[0],code},reasonCode:code,result:'DENIED',severity:'WARNING',requestId:req.requestId??randomUUID(),correlationId}));}catch{/* failed audit is handled by runtime structured logging */}}
  async canActivate(ctx:ExecutionContext){
    const req=ctx.switchToHttp().getRequest(),url=String(req.originalUrl ?? req.url ?? ''); if(!/(?:^|\/api\/v1)\/admin(?:\/|$)/.test(url)) return true;
    const bypass=this.config.get<string>('ADMIN_AUTH_BYPASS')==='true',env=this.config.get<string>('NODE_ENV') ?? 'development'; if(bypass && env!=='production'){req.user=req.user ?? {sessionId:'DEV_BYPASS',personId:undefined,provider:'ADMIN_LOCAL',subject:'dev-bypass',role:'SUPER_ADMIN'};return true;}
    const auth=String(req.headers?.authorization??'');if(!auth.startsWith('Bearer ')){await this.denied(req,'ADMIN_BEARER_REQUIRED');throw new UnauthorizedException({code:'ADMIN_BEARER_REQUIRED'});}
    try{req.user=await this.tokens.authenticate(auth.slice(7));}catch(error){await this.denied(req,'ADMIN_SESSION_INVALID');throw error;}
    if(!req.user?.role){await this.denied(req,'ADMIN_ROLE_REQUIRED');throw new UnauthorizedException({code:'ADMIN_ROLE_REQUIRED'});}return true;
  }
}
