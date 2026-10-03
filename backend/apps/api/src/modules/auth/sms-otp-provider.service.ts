import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class SmsOtpProviderService {
 constructor(private readonly config:ConfigService){}
 assertConfigured(){
  const endpoint=this.config.get<string>('EVERY8D_SMS_ENDPOINT'),uid=this.config.get<string>('EVERY8D_UID'),password=this.config.get<string>('EVERY8D_PASSWORD');
  if(!endpoint||!uid||!password)throw new ServiceUnavailableException({code:'SMS_PROVIDER_CONFIGURATION_PENDING'});
  try{const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.pathname.toLowerCase().endsWith('/api21/http/sendsms.ashx'))throw Error();}catch{throw new ServiceUnavailableException({code:'SMS_PROVIDER_CONFIGURATION_PENDING'});}
  return {endpoint,uid,password};
 }
 async send(destination:string,code:string):Promise<{providerRef:string}>{
  const {endpoint,uid,password}=this.assertConfigured();
  if(!/^\+[1-9][0-9]{7,14}$/.test(destination)||!/^\d{6}$/.test(code))throw new ServiceUnavailableException({code:'SMS_DELIVERY_FAILED'});
  try{
   const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({UID:uid,PWD:password,SB:'UCell 驗證碼',MSG:`UCell 驗證碼：${code}，5 分鐘內有效。請勿提供給他人。`,DEST:destination,ST:'',RETRYTIME:'5'})});
   const parts=(await response.text()).trim().split(',');
   if(!response.ok||parts.length!==5||!Number.isFinite(Number(parts[0]))||Number(parts[0])<0||parts[1]!=='1'||parts[3]!=='0'||!/^[a-f0-9-]{36}$/i.test(parts[4]))throw Error();
   return {providerRef:parts[4]};
  }catch{throw new ServiceUnavailableException({code:'SMS_DELIVERY_FAILED'});}
 }
}
