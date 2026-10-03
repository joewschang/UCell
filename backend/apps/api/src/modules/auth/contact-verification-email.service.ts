import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
@Injectable()
export class ContactVerificationEmailService{
 constructor(private readonly config:ConfigService){}
 assertConfigured(){
  const endpoint=this.config.get<string>('CONTACT_VERIFICATION_EMAIL_WEBHOOK_URL'),token=this.config.get<string>('CONTACT_VERIFICATION_EMAIL_WEBHOOK_TOKEN');
  if(!endpoint||!token)throw new ServiceUnavailableException({code:'EMAIL_PROVIDER_CONFIGURATION_PENDING'});
  try{const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{throw new ServiceUnavailableException({code:'EMAIL_PROVIDER_CONFIGURATION_PENDING'});}
  return {endpoint,token};
 }
 async send(to:string,code:string){
  const {endpoint,token}=this.assertConfigured();
  try{const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({template:'UCELL_CONTACT_VERIFICATION',to,code,expiresInSeconds:300})});if(!response.ok)throw Error();}
  catch{throw new ServiceUnavailableException({code:'EMAIL_DELIVERY_FAILED'});}
 }
}
