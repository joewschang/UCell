import { Injectable,UnauthorizedException,UnprocessableEntityException } from '@nestjs/common';
import { Prisma,PrismaService } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import { OtpService } from './otp.service';
import { IdentityTokenService } from './identity-token.service';

@Injectable()
export class MemberOtpAuthService{
 constructor(private readonly db:PrismaService,private readonly otp:OtpService){}

 async createLoginChallenge(mobile:string,key:string){
  const people=await this.db.person.findMany({where:{mobile,mobileVerifiedAt:{not:null},status:'EFFECTIVE'},select:{personId:true},take:2});
  if(people.length!==1){
    return {challengeId:randomUUID(),status:'PENDING',expiresAt:new Date(Date.now()+300000).toISOString(),resendAvailableAt:new Date(Date.now()+60000).toISOString(),accepted:true};
  }
  const result=await this.otp.create({purpose:'LOGIN',destination:mobile,personId:people[0].personId},key);
  return {...result,accepted:true};
 }

 async verifyLogin(challengeId:string,code:string){
  try{await this.otp.verify(challengeId,code);}catch{throw new UnauthorizedException({code:'OTP_LOGIN_INVALID'});}
  const now=new Date();
  return this.db.$transaction(async tx=>{
    const rows=await tx.$queryRaw<Array<{personId:string|null;purpose:string;status:string;consumedAt:Date|null;expiresAt:Date;destinationFingerprint:string}>>`
      SELECT person_id AS "personId",purpose::text,status::text,consumed_at AS "consumedAt",expires_at AS "expiresAt",destination_fingerprint AS "destinationFingerprint"
      FROM identity.otp_challenge WHERE otp_challenge_id=${challengeId}::uuid FOR UPDATE`;
    const row=rows[0];
    if(!row||row.purpose!=='LOGIN'||row.status!=='VERIFIED'||row.consumedAt||row.expiresAt<=now||!row.personId)throw new UnauthorizedException({code:'OTP_LOGIN_INVALID'});
    const person=await tx.person.findUnique({where:{personId:row.personId},select:{personId:true,mobile:true,mobileVerifiedAt:true,status:true}});
    if(!person||person.status!=='EFFECTIVE'||!person.mobile||!person.mobileVerifiedAt)throw new UnauthorizedException({code:'OTP_LOGIN_INVALID'});
    await tx.otpChallenge.update({where:{otpChallengeId:challengeId},data:{consumedAt:now,consumedByPersonId:person.personId}});
    return new IdentityTokenService(tx as any).issue({provider:'SMS_OTP',subject:person.mobile,personId:person.personId,ttlSeconds:3600});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }
}
