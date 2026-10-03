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
  normalizeIdentityDocumentNumber(value:string){return value.trim().toUpperCase().replace(/\s+/g,'');}
  normalizeNationalId(value:string){return this.normalizeIdentityDocumentNumber(value);}
  fingerprintIdentityDocument(nationalityCode:string,documentType:string,value:string){
    const nationality=nationalityCode.trim().toUpperCase();
    const type=documentType.trim().toUpperCase();
    const normalized=this.normalizeIdentityDocumentNumber(value);
    if(!/^[A-Z]{2}$/.test(nationality)||!['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER'].includes(type)||!normalized)throw new ServiceUnavailableException({code:'IDENTITY_MATCH_VALUE_REQUIRED'});
    return createHmac('sha256',this.secret()).update('IDENTITY_DOCUMENT\0'+nationality+'\0'+type+'\0'+normalized,'utf8').digest('hex');
  }
  fingerprintNationalId(value:string){return this.fingerprintIdentityDocument('TW','NATIONAL_ID',value);}
}
