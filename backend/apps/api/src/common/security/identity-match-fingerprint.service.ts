import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {createHmac} from 'node:crypto';

@Injectable()
export class IdentityMatchFingerprintService {
  private secret(){
    const configured=process.env.IDENTITY_MATCH_HMAC_SECRET;
    if(configured&&configured.length>=32)return configured;
    if(process.env.NODE_ENV==='test')return 'UCELL_TEST_ONLY_IDENTITY_MATCH_SECRET_DO_NOT_USE_IN_PROD';
    throw new ServiceUnavailableException({code:'IDENTITY_MATCH_HMAC_CONFIGURATION_PENDING'});
  }
  normalizeNationalId(value:string){return value.trim().toUpperCase().replace(/\s+/g,'');}
  fingerprintNationalId(value:string){
    const normalized=this.normalizeNationalId(value);
    if(!normalized)throw new ServiceUnavailableException({code:'IDENTITY_MATCH_VALUE_REQUIRED'});
    return createHmac('sha256',this.secret()).update('NATIONAL_ID\0'+normalized,'utf8').digest('hex');
  }
}
