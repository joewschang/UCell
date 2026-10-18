import {Injectable,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '@ucell/database';
import {createHash,randomBytes} from 'node:crypto';
import {ContactVerificationService,normalizeContact} from './contact-verification.service';

@Injectable()
export class SmsLoginService{
 constructor(private readonly db:PrismaService,private readonly config:ConfigService,private readonly verification:ContactVerificationService){}
 enabled(){return this.config.get('AUTH_MEMBER_SMS_LOGIN_ENABLED')==='true';}
 private assertEnabled(){if(!this.enabled())throw new ServiceUnavailableException({code:'SMS_OTP_FEATURE_DISABLED'});}
 private async person(db:any,mobile:string){
  const local=/^\+8869\d{8}$/.test(mobile)?'0'+mobile.slice(4):mobile;
  const rows=await db.person.findMany({where:{mobile:{in:[mobile,local]},status:'EFFECTIVE',securityStatus:'NORMAL'},take:2});
  return rows.length===1&&rows[0].mobileVerifiedAt?rows[0]:null;
 }
 async request(mobileInput:string,key:string){
  this.assertEnabled();const mobile=normalizeContact('SMS',mobileInput),person=await this.person(this.db,mobile);
  // Reserve and throttle unknown/unverified destinations too; never disclose account existence.
  const result=await this.verification.send('LOGIN:'+mobile,'LOGIN','SMS',mobile,key,!!person);
  return {challengeId:result.challengeId,expiresAt:result.expiresAt,resendAt:result.resendAt,status:'ACCEPTED'};
 }
 async login(mobileInput:string,challengeId:string,code:string){
  this.assertEnabled();const mobile=normalizeContact('SMS',mobileInput),owner='LOGIN:'+mobile;
  const verified=await this.verification.verify(owner,'LOGIN','SMS',mobile,challengeId,code);
  return this.db.$transaction(async tx=>{
   const person=await this.person(tx,mobile);if(!person)throw new UnauthorizedException({code:'SMS_LOGIN_INVALID'});
   await tx.$queryRaw`SELECT person_id FROM identity.person WHERE person_id=${person.personId}::uuid FOR UPDATE`;
   const current=await this.person(tx,mobile);if(!current||current.personId!==person.personId)throw new UnauthorizedException({code:'SMS_LOGIN_INVALID'});
   await this.verification.consume(tx,owner,'LOGIN','SMS',mobile,verified.proof);
   const accessToken=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+3600000);
   const session=await tx.authSession.create({data:{personId:person.personId,provider:'MEMBER_LOCAL',subject:person.memberNo,tokenHash:createHash('sha256').update(accessToken).digest('hex'),status:'ACTIVE',issuedAt:new Date(),expiresAt}});
   return {accessToken,expiresAt,sessionId:session.authSessionId};
  });
 }
}
