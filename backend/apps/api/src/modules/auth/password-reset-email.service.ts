import { Injectable,ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Microsoft365MailService } from './microsoft365-mail.service';

@Injectable()
export class PasswordResetEmailService{
 private readonly microsoft:Microsoft365MailService;
 constructor(private readonly config:ConfigService){this.microsoft=new Microsoft365MailService(config);}
 assertConfigured(){
  if(this.microsoft.isSelected()){this.microsoft.assertConfigured();return {endpoint:'',token:''};}
  const endpoint=this.config.get<string>('PASSWORD_RESET_EMAIL_WEBHOOK_URL'),token=this.config.get<string>('PASSWORD_RESET_EMAIL_WEBHOOK_TOKEN');
  if(!endpoint||!token)throw new ServiceUnavailableException({code:'PASSWORD_RESET_EMAIL_PROVIDER_NOT_CONFIGURED'});
  return {endpoint,token};
 }
 async send(input:{to:string;resetUrl:string}){
  if(this.microsoft.isSelected()){
   this.microsoft.assertConfigured();
   try{await this.microsoft.send({to:input.to,subject:'UCell 會員密碼重設',text:`請使用以下連結重設您的 UCell 密碼：\n${input.resetUrl}\n\n若非您本人操作，請忽略此信。請勿將此連結提供給他人。`});return;}
   catch{throw new ServiceUnavailableException({code:'PASSWORD_RESET_EMAIL_DELIVERY_FAILED'});}
  }
  const {endpoint,token}=this.assertConfigured();
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({template:'UCELL_PASSWORD_RESET',to:input.to,resetUrl:input.resetUrl})});
  if(!response.ok)throw new ServiceUnavailableException({code:'PASSWORD_RESET_EMAIL_DELIVERY_FAILED'});
 }
}
