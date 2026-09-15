import { Injectable,UnauthorizedException } from '@nestjs/common';
import { createHash,randomBytes } from 'crypto';
import { PrismaService } from '@ucell/database';

@Injectable()
export class IdentityTokenService{
  constructor(private readonly prisma:PrismaService){}
  hash(raw:string){return createHash('sha256').update(raw).digest('hex');}
  async issue(input:{provider:'ADMIN_LOCAL'|'ENTRA'|'LINE';subject:string;personId?:string;roleCode?:string;ttlSeconds?:number}){
    const raw=randomBytes(32).toString('base64url');
    const now=new Date(); const expiresAt=new Date(now.getTime()+(input.ttlSeconds??3600)*1000);
    const session=await this.prisma.authSession.create({data:{personId:input.personId,provider:input.provider,subject:input.subject,roleCode:input.roleCode,tokenHash:this.hash(raw),status:'ACTIVE',issuedAt:now,expiresAt}});
    return {accessToken:raw,expiresAt,sessionId:session.authSessionId};
  }
  async authenticate(raw:string){
    const session=await this.prisma.authSession.findUnique({where:{tokenHash:this.hash(raw)}});
    if(!session||session.status!=='ACTIVE'||session.expiresAt<=new Date()) throw new UnauthorizedException('SESSION_INVALID');
    return {sessionId:session.authSessionId,personId:session.personId,provider:session.provider,subject:session.subject,role:session.roleCode};
  }
}
