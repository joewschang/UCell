import { Injectable,ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordResetEmailService{
 constructor(private readonly config:ConfigService){}
 assertConfigured(){
  const endpoint=this.config.get<string>('PASSWORD_RESET_EMAIL_WEBHOOK_URL'),token=this.config.get<string>('PASSWORD_RESET_EMAIL_WEBHOOK_TOKEN');
  if(!endpoint||!token)throw new ServiceUnavailableException({code:'PASSWORD_RESET_EMAIL_PROVIDER_NOT_CONFIGURED'});
  return {endpoint,token};
 }
 async send(input:{to:string;resetUrl:string}){
  const {endpoint,token}=this.assertConfigured();
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({template:'UCELL_PASSWORD_RESET',to:input.to,resetUrl:input.resetUrl})});
  if(!response.ok)throw new ServiceUnavailableException({code:'PASSWORD_RESET_EMAIL_DELIVERY_FAILED'});
 }
}
