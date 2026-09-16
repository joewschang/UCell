import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class SmsOtpProviderService {
 async send(_destination:string,_code:string):Promise<{providerRef:string}>{
  throw new ServiceUnavailableException({code:'SMS_PROVIDER_CONFIGURATION_PENDING'});
 }
}
