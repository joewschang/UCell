import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Microsoft365MailService} from './microsoft365-mail.service';
@Injectable()
export class ContactVerificationEmailService{
 private readonly microsoft:Microsoft365MailService;
 constructor(private readonly config:ConfigService){this.microsoft=new Microsoft365MailService(config);}
 assertConfigured(){
  try{if(this.microsoft.isSelected()){this.microsoft.assertConfigured();return {endpoint:'',token:''};}}
  catch{throw new ServiceUnavailableException({code:'EMAIL_PROVIDER_CONFIGURATION_PENDING'});}
  const endpoint=this.config.get<string>('CONTACT_VERIFICATION_EMAIL_WEBHOOK_URL'),token=this.config.get<string>('CONTACT_VERIFICATION_EMAIL_WEBHOOK_TOKEN');
  if(!endpoint||!token)throw new ServiceUnavailableException({code:'EMAIL_PROVIDER_CONFIGURATION_PENDING'});
  try{const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{throw new ServiceUnavailableException({code:'EMAIL_PROVIDER_CONFIGURATION_PENDING'});}
  return {endpoint,token};
 }
 async send(to:string,code:string){
  const configured=this.assertConfigured();
  if(this.microsoft.isSelected()){
   try{await this.microsoft.send({to,subject:'UCell 會員 Email 驗證碼',text:`您的 UCell 驗證碼為 ${code}，有效時間為 5 分鐘。\n\n請勿將驗證碼提供給他人。若非您本人操作，請忽略此信。`});return;}
   catch{throw new ServiceUnavailableException({code:'EMAIL_DELIVERY_FAILED'});}
  }
  const {endpoint,token}=configured;
  try{const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({template:'UCELL_CONTACT_VERIFICATION',from:'service@ucell.life',to,code,expiresInSeconds:300})});if(!response.ok)throw Error();}
  catch{throw new ServiceUnavailableException({code:'EMAIL_DELIVERY_FAILED'});}
 }
}
