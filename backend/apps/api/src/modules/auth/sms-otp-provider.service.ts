import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class SmsOtpProviderService {
 private readonly logger=new Logger(SmsOtpProviderService.name);
 constructor(private readonly config:ConfigService){}
 assertConfigured(){
  const endpoint=this.config.get<string>('EVERY8D_SMS_ENDPOINT'),uid=this.config.get<string>('EVERY8D_UID'),password=this.config.get<string>('EVERY8D_PASSWORD');
  if(!endpoint||!uid||!password)throw new ServiceUnavailableException({code:'SMS_PROVIDER_CONFIGURATION_PENDING'});
  try{const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.pathname.toLowerCase().endsWith('/api21/http/sendsms.ashx'))throw Error();}catch{throw new ServiceUnavailableException({code:'SMS_PROVIDER_CONFIGURATION_PENDING'});}
  return {endpoint,uid,password};
 }
 async send(destination:string,code:string):Promise<{providerRef:string}>{
  if(!/^\+[1-9][0-9]{7,14}$/.test(destination)||!/^\d{6}$/.test(code))throw new ServiceUnavailableException({code:'SMS_DELIVERY_FAILED'});
  return this.sendMessage([destination],`UCell 驗證碼：${code}，5 分鐘內有效。請勿提供給他人。`,'UCell 驗證碼','5');
 }
 async sendMessage(destinations:string[],message:string,subject='UCell 通知',retryTime='1440'):Promise<{providerRef:string}>{
  const {endpoint,uid,password}=this.assertConfigured();
  if(!destinations.length||destinations.length>500||new Set(destinations).size!==destinations.length||destinations.some(d=>!/^\+[1-9][0-9]{7,14}$/.test(d))||!message.trim()||message.length>300)throw new ServiceUnavailableException({code:'SMS_DELIVERY_FAILED'});
  try{
   const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({UID:uid,PWD:password,SB:subject,MSG:message,DEST:destinations.join(','),ST:'',RETRYTIME:retryTime})});
   if(!response.ok){this.logger.warn({event:'SMS_PROVIDER_HTTP_REJECTED',httpStatus:response.status});throw Error();}
   const parts=(await response.text()).trim().split(',');
   if(/^-\d{1,5}$/.test(parts[0]))this.logger.warn({event:'SMS_PROVIDER_REJECTED',providerCode:parts[0]});
   if(!response.ok||parts.length!==5||!Number.isFinite(Number(parts[0]))||Number(parts[0])<0||Number(parts[1])!==destinations.length||parts[3]!=='0'||!/^[a-f0-9-]{36}$/i.test(parts[4]))throw Error();
   return {providerRef:parts[4]};
  }catch{throw new ServiceUnavailableException({code:'SMS_DELIVERY_FAILED'});}
 }
}
