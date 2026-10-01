import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class SmsOtpProviderService {
 async send(destination:string,code:string):Promise<{providerRef:string}>{
  const endpoint=process.env.SMS_OTP_PROVIDER_WEBHOOK_URL,token=process.env.SMS_OTP_PROVIDER_WEBHOOK_TOKEN;
  if(!endpoint||!token)throw new ServiceUnavailableException({code:'SMS_PROVIDER_CONFIGURATION_PENDING'});
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({template:'UCELL_OTP',destination,code})});
  if(!response.ok)throw new ServiceUnavailableException({code:'SMS_PROVIDER_DELIVERY_FAILED'});
  let providerRef='WEBHOOK';try{const body=await response.json() as {providerRef?:unknown};if(typeof body.providerRef==='string'&&body.providerRef)providerRef=body.providerRef;}catch{/* Provider reference is optional. */}
  return {providerRef};
 }
}
