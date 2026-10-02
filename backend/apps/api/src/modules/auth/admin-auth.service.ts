import { Injectable,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { EntraTokenVerifierService } from './entra-token-verifier.service';
import { IdentityTokenService } from './identity-token.service';

@Injectable()
export class AdminAuthService{
  constructor(private readonly prisma:PrismaService,private readonly entra:EntraTokenVerifierService,private readonly sessions:IdentityTokenService,private readonly config:ConfigService,private readonly audit:AuditService){}

  private async recordFailedLogin(input:{subjectPresent:boolean;reasonCode:string;requestId:string;correlationId:string}){
    try{
      await this.prisma.$transaction(tx=>this.audit.write(tx,{actorType:'SYSTEM',action:'LOGIN_FAILED',eventCode:'LOGIN_FAILED',entityType:'AdminAuthentication',afterData:{provider:'ENTRA',subjectPresent:input.subjectPresent},reasonCode:input.reasonCode,result:'DENIED',severity:'WARNING',requestId:input.requestId,correlationId:input.correlationId}));
    }catch{
      // Authentication remains fail-closed even when the append-only audit store is unavailable.
      // The caller's original controlled authentication error must remain observable.
    }
  }

  async exchangeEntra(idToken:string,requestId=randomUUID(),correlationId=randomUUID()){
    let subject='UNVERIFIED';
    try{
      const v=await this.entra.verify(idToken);subject=v.subject;const now=new Date();
      const grant=await this.prisma.adminAccessGrant.findFirst({where:{provider:'ENTRA',providerSubject:v.subject,status:'ACTIVE',validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]},include:{person:true},orderBy:{validFrom:'desc'}});
      if(!grant) throw new UnauthorizedException({code:'ADMIN_ACCESS_NOT_GRANTED'});
      const linked=await this.prisma.identityLink.findUnique({where:{provider_providerSubject:{provider:'ENTRA',providerSubject:v.subject}}});
      if(!linked) await this.prisma.identityLink.create({data:{personId:grant.personId,provider:'ENTRA',providerSubject:v.subject,email:v.email,displayName:v.displayName}});
      else if(linked.personId!==grant.personId) throw new UnauthorizedException({code:'ENTRA_IDENTITY_GRANT_MISMATCH'});
      const issued=await this.sessions.issue({provider:'ENTRA',subject:v.subject,personId:grant.personId,roleCode:grant.roleCode,ttlSeconds:Number(this.config.get('ADMIN_SESSION_TTL_SECONDS')??3600)});
      await this.prisma.$transaction(tx=>this.audit.write(tx,{actorType:'USER',actorId:grant.personId,actorRoleSnapshot:grant.roleCode,action:'LOGIN_SUCCEEDED',eventCode:'LOGIN_SUCCEEDED',entityType:'AuthSession',entityId:issued.sessionId,afterData:{provider:'ENTRA',role:grant.roleCode},requestId,correlationId}));
      return {...issued,user:{personId:grant.personId,legalName:grant.person.legalName,preferredName:grant.person.preferredName,role:grant.roleCode,provider:'ENTRA'}};
    }catch(error){
      const code=error && typeof error==='object' && 'getResponse' in error ? String(((error as any).getResponse()?.code) ?? 'AUTH_LOGIN_FAILED') : 'AUTH_LOGIN_FAILED';
      await this.recordFailedLogin({subjectPresent:subject!=='UNVERIFIED',reasonCode:code,requestId,correlationId});
      throw error;
    }
  }
  async me(sessionId:string){const s=await this.prisma.authSession.findUniqueOrThrow({where:{authSessionId:sessionId},include:{person:true}});return {sessionId:s.authSessionId,provider:s.provider,subject:s.subject,role:s.roleCode,expiresAt:s.expiresAt,person:s.person?{personId:s.person.personId,legalName:s.person.legalName,preferredName:s.person.preferredName,email:s.person.email}:null};}
  async logout(sessionId:string,requestId=randomUUID(),correlationId=randomUUID()){
    const revoked=await this.prisma.authSession.update({where:{authSessionId:sessionId},data:{status:'REVOKED',revokedAt:new Date()}});
    await this.prisma.$transaction(tx=>this.audit.write(tx,{actorType:'USER',actorId:revoked.personId??undefined,action:'LOGOUT',eventCode:'LOGOUT',entityType:'AuthSession',entityId:revoked.authSessionId,afterData:{provider:revoked.provider},requestId,correlationId}));
    return revoked;
  }
}
