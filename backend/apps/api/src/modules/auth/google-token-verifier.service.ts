import { Injectable,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet,jwtVerify } from 'jose';

@Injectable()
export class GoogleTokenVerifierService{
  private readonly jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{cooldownDuration:30_000,cacheMaxAge:600_000});
  constructor(private readonly config:ConfigService){}

  async verify(idToken:string){
    const clientId=this.config.get<string>('GOOGLE_OIDC_CLIENT_ID');
    if(!clientId)throw new UnauthorizedException('GOOGLE_NOT_CONFIGURED');
    try{
      const result=await jwtVerify(idToken,this.jwks,{
        issuer:['https://accounts.google.com','accounts.google.com'],
        audience:clientId,
        clockTolerance:30,
      });
      const p:any=result.payload;
      const subject=String(p.sub??'');
      if(!subject)throw new Error('subject');
      return {
        subject,
        email:typeof p.email==='string'?p.email:undefined,
        emailVerified:p.email_verified===true,
        displayName:typeof p.name==='string'?p.name:undefined,
        expiresAt:typeof p.exp==='number'?p.exp:0,
      };
    }catch{
      throw new UnauthorizedException('GOOGLE_TOKEN_INVALID');
    }
  }
}
