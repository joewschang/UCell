import { Injectable,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ucell/database';
import { EntraTokenVerifierService } from './entra-token-verifier.service';
import { IdentityTokenService } from './identity-token.service';

@Injectable()
export class AdminAuthService{
  constructor(
    private readonly prisma:PrismaService,
    private readonly entra:EntraTokenVerifierService,
    private readonly sessions:IdentityTokenService,
    private readonly config:ConfigService
  ){}

  async exchangeEntra(idToken:string){
    const v=await this.entra.verify(idToken);
    const now=new Date();
    const grant=await this.prisma.adminAccessGrant.findFirst({
      where:{
        provider:'ENTRA',providerSubject:v.subject,status:'ACTIVE',
        validFrom:{lte:now},
        OR:[{validTo:null},{validTo:{gt:now}}]
      },
      include:{person:true},
      orderBy:{validFrom:'desc'}
    });
    if(!grant) throw new UnauthorizedException('ADMIN_ACCESS_NOT_GRANTED');

    const linked=await this.prisma.identityLink.findUnique({
      where:{provider_providerSubject:{provider:'ENTRA',providerSubject:v.subject}}
    });
    if(!linked){
      await this.prisma.identityLink.create({
        data:{
          personId:grant.personId,provider:'ENTRA',providerSubject:v.subject,
          email:v.email,displayName:v.displayName
        }
      });
    }else if(linked.personId!==grant.personId){
      throw new UnauthorizedException('ENTRA_IDENTITY_GRANT_MISMATCH');
    }

    const issued=await this.sessions.issue({
      provider:'ENTRA',subject:v.subject,personId:grant.personId,
      roleCode:grant.roleCode,ttlSeconds:Number(this.config.get('ADMIN_SESSION_TTL_SECONDS')??3600)
    });

    return {
      ...issued,
      user:{
        personId:grant.personId,
        legalName:grant.person.legalName,
        preferredName:grant.person.preferredName,
        role:grant.roleCode,
        provider:'ENTRA'
      }
    };
  }

  async me(sessionId:string){
    const s=await this.prisma.authSession.findUniqueOrThrow({
      where:{authSessionId:sessionId},include:{person:true}
    });
    return {
      sessionId:s.authSessionId,provider:s.provider,subject:s.subject,
      role:s.roleCode,expiresAt:s.expiresAt,
      person:s.person?{
        personId:s.person.personId,legalName:s.person.legalName,
        preferredName:s.person.preferredName,email:s.person.email
      }:null
    };
  }

  async logout(sessionId:string){
    return this.prisma.authSession.update({
      where:{authSessionId:sessionId},
      data:{status:'REVOKED',revokedAt:new Date()}
    });
  }
}
