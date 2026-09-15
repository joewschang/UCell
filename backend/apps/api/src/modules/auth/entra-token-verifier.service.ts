import { Injectable,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet,jwtVerify,JWTVerifyResult } from 'jose';

@Injectable()
export class EntraTokenVerifierService{
  private jwksCache=new Map<string,ReturnType<typeof createRemoteJWKSet>>();

  constructor(private readonly config:ConfigService){}

  async verify(idToken:string){
    const tenantId=this.config.get<string>('ENTRA_TENANT_ID');
    const clientId=this.config.get<string>('ENTRA_CLIENT_ID');
    if(!tenantId||!clientId) throw new UnauthorizedException('ENTRA_NOT_CONFIGURED');

    const issuer=`https://login.microsoftonline.com/${tenantId}/v2.0`;
    const jwksUrl=new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`);
    let jwks=this.jwksCache.get(tenantId);
    if(!jwks){
      jwks=createRemoteJWKSet(jwksUrl,{cooldownDuration:30_000,cacheMaxAge:600_000});
      this.jwksCache.set(tenantId,jwks);
    }

    let verified:JWTVerifyResult;
    try{
      verified=await jwtVerify(idToken,jwks,{
        issuer,
        audience:clientId,
        clockTolerance:30,
      });
    }catch{
      throw new UnauthorizedException('ENTRA_TOKEN_INVALID');
    }

    const p:any=verified.payload;
    const subject=String(p.oid??p.sub??'');
    const tenant=String(p.tid??'');
    if(!subject||tenant!==tenantId) throw new UnauthorizedException('ENTRA_CLAIMS_INVALID');

    return {
      subject,
      tenantId:tenant,
      email:String(p.preferred_username??p.email??'')||undefined,
      displayName:String(p.name??'')||undefined,
      claims:{
        oid:p.oid,sub:p.sub,tid:p.tid,preferred_username:p.preferred_username,
        name:p.name,iat:p.iat,exp:p.exp
      }
    };
  }
}
