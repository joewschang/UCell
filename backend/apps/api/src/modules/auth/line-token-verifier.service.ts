import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyLineIdToken, LineVerificationError } from './line-token-verifier';
@Injectable()
export class LineTokenVerifierService {
 constructor(private readonly config:ConfigService){}
 async verify(token:string){
  try{return await verifyLineIdToken(token,{channelId:this.config.get('LINE_LOGIN_CHANNEL_ID')??''});}
  catch(error){
   if(error instanceof LineVerificationError && ['LINE_NOT_CONFIGURED','LINE_VERIFICATION_UNAVAILABLE'].includes(error.message))throw new ServiceUnavailableException({code:error.message});
   throw new UnauthorizedException({code:'LINE_TOKEN_INVALID'});
  }
 }
}
