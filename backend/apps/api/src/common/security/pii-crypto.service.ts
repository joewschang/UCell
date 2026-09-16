import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

@Injectable()
export class PiiCryptoService {
 private config(){const raw=process.env.PII_ENCRYPTION_KEY,version=process.env.PII_ENCRYPTION_KEY_VERSION;if(!raw||!version||!/^[A-Za-z0-9._-]{1,64}$/.test(version))throw new ServiceUnavailableException({code:'PII_ENCRYPTION_CONFIGURATION_PENDING'});const key=Buffer.from(raw,'base64');if(key.length!==32)throw new ServiceUnavailableException({code:'PII_ENCRYPTION_CONFIGURATION_PENDING'});return {key,version};}
 encrypt(value:unknown){const {key,version}=this.config(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return {ciphertext:Buffer.concat([iv,tag,body]).toString('base64url'),keyVersion:version};}
 decrypt<T>(ciphertext:string,keyVersion:string):T{const {key,version}=this.config();if(version!==keyVersion)throw new ServiceUnavailableException({code:'PII_KEY_VERSION_UNAVAILABLE'});try{const bytes=Buffer.from(ciphertext,'base64url'),decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8')) as T;}catch{throw new ServiceUnavailableException({code:'PII_DECRYPTION_FAILED'});}}
}
