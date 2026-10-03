import { ConflictException,Injectable,Optional,UnauthorizedException,UnprocessableEntityException } from '@nestjs/common';
import { LineTokenVerifierService } from './line-token-verifier.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@ucell/database';
import { createHash,randomBytes,scryptSync,timingSafeEqual } from 'node:crypto';
import { IdentityTokenService } from './identity-token.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import { PasswordResetEmailService } from './password-reset-email.service';

const PASSWORD_MIN=12,MAX_ATTEMPTS=5,LOCK_MS=15*60*1000;
function derive(password:string,salt:string,length:number,N:number,r:number,p:number){return scryptSync(password,salt,length,{N,r,p,maxmem:64*1024*1024});}

@Injectable()
export class MemberWebAuthService{
 constructor(private readonly db:PrismaService,private readonly sessions:IdentityTokenService,private readonly google:GoogleTokenVerifierService,private readonly email:PasswordResetEmailService,private readonly config:ConfigService,@Optional() private readonly line?:LineTokenVerifierService){}

 async linkLine(personId:string,idToken:string){
  if(!this.line)throw new UnauthorizedException({code:'LINE_TOKEN_INVALID'});
  const verified=await this.line.verify(idToken);
  const person=await this.db.person.findUnique({where:{personId}});
  if(!person)throw new UnauthorizedException({code:'MEMBER_PERSON_DISABLED'});
  this.eligible(person);
  try{return await this.db.$transaction(async tx=>{
   const locked=await tx.$queryRaw<Array<{status:string;securityStatus:string}>>`SELECT status,security_status AS "securityStatus" FROM identity.person WHERE person_id=${personId}::uuid FOR UPDATE`;
   if(!locked[0])throw new UnauthorizedException({code:'MEMBER_PERSON_DISABLED'});
   this.eligible(locked[0]);
   const existing=await tx.identityLink.findUnique({where:{provider_providerSubject:{provider:'LINE',providerSubject:verified.subject}}});
   if(existing&&(existing.personId!==personId||existing.status!=='ACTIVE'))throw new ConflictException({code:'LINE_IDENTITY_ALREADY_LINKED'});
   const other=await tx.identityLink.findFirst({where:{personId,provider:'LINE',providerSubject:{not:verified.subject}}});
   if(other)throw new ConflictException({code:'MEMBER_LINE_ALREADY_LINKED'});
   if(!existing)await tx.identityLink.create({data:{personId,provider:'LINE',providerSubject:verified.subject}});
   return {provider:'LINE',linked:true};
  });}catch(error){
   if(error&&typeof error==='object'&&'code' in error&&error.code==='P2002')throw new ConflictException({code:'LINE_IDENTITY_ALREADY_LINKED'});
   throw error;
  }
 }
 async loginMethods(personId:string){
  const links=await this.db.identityLink.findMany({where:{personId,status:'ACTIVE',provider:{in:['GOOGLE','LINE']}},select:{provider:true}});
  return {google:links.some(x=>x.provider==='GOOGLE'),line:links.some(x=>x.provider==='LINE')};
 }

 private async hashPassword(password:string,salt=randomBytes(16).toString('base64url')){
  if(password.length<PASSWORD_MIN||password.length>256)throw new UnprocessableEntityException({code:'PASSWORD_POLICY'});
  const key=derive(password,salt,32,16384,8,1);
  return `scrypt$16384$8$1$${salt}$${key.toString('base64url')}`;
 }
 private async verifyPassword(password:string,encoded:string){
  const [kind,n,r,p,salt,value]=encoded.split('$');if(kind!=='scrypt'||!n||!r||!p||!salt||!value)return false;
  const expected=Buffer.from(value,'base64url'),actual=derive(password,salt,expected.length,Number(n),Number(r),Number(p));
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
 }
 private eligible(person:{status:string;securityStatus?:string}){if(person.status!=='EFFECTIVE')throw new UnauthorizedException({code:'MEMBER_PERSON_DISABLED'});if(person.securityStatus&&person.securityStatus!=='NORMAL')throw new UnauthorizedException({code:'MEMBER_SECURITY_LOCKED'});}

 async passwordLogin(identifier:string,password:string){
  const value=identifier.trim(),compact=value.replace(/[\s()-]/g,'');
  let person;
  if(value.includes('@')){
   const matches=await this.db.person.findMany({where:{email:{equals:value,mode:'insensitive'}},include:{memberPasswordCredential:true},take:2});
   person=matches.length===1?matches[0]:undefined;
  }else if(/^09\d{8}$/.test(compact)||/^\+[1-9]\d{7,14}$/.test(compact)){
   const mobile=/^09\d{8}$/.test(compact)?'+886'+compact.slice(1):compact;
   const local=/^\+8869\d{8}$/.test(mobile)?'0'+mobile.slice(4):mobile;
   const matches=await this.db.person.findMany({where:{OR:[{mobile:{in:[mobile,local]}},{memberNo:value}]},include:{memberPasswordCredential:true},take:2});
   person=matches.length===1?matches[0]:undefined;
  }else if(/^\d{10}$/.test(value)){
   person=await this.db.person.findUnique({where:{memberNo:value},include:{memberPasswordCredential:true}});
  }
  if(!person||!person.memberPasswordCredential){
    // Equalize the dominant password-derivation cost for unknown/unconfigured accounts.
    derive(password,'ucell-member-login-dummy',32,16384,8,1);
    throw new UnauthorizedException({code:'MEMBER_LOGIN_INVALID'});
  }
  this.eligible(person);
  const credential=person.memberPasswordCredential,now=new Date();
  if(credential.lockedUntil&&credential.lockedUntil>now)throw new UnauthorizedException({code:'MEMBER_LOGIN_INVALID'});
  const ok=await this.verifyPassword(password,credential.passwordHash);
  if(!ok){
    const attempts=credential.failedAttemptCount+1;
    await this.db.memberPasswordCredential.update({where:{personId:person.personId},data:{failedAttemptCount:attempts,lockedUntil:attempts>=MAX_ATTEMPTS?new Date(now.getTime()+LOCK_MS):null}});
    throw new UnauthorizedException({code:'MEMBER_LOGIN_INVALID'});
  }
  if(credential.failedAttemptCount||credential.lockedUntil)await this.db.memberPasswordCredential.update({where:{personId:person.personId},data:{failedAttemptCount:0,lockedUntil:null}});
  return this.sessions.issue({provider:'MEMBER_LOCAL',subject:person.memberNo,personId:person.personId,ttlSeconds:Number(this.config.get('MEMBER_SESSION_TTL_SECONDS')??3600)});
 }

 async googleExchange(idToken:string){
  const verified=await this.google.verify(idToken);
  const link=await this.db.identityLink.findUnique({where:{provider_providerSubject:{provider:'GOOGLE',providerSubject:verified.subject}},include:{person:true}});
  if(!link||link.status!=='ACTIVE')throw new UnauthorizedException({code:'GOOGLE_ACCOUNT_UNBOUND'});
  this.eligible(link.person);
  const ttl=Math.max(1,Math.min(3600,verified.expiresAt-Math.floor(Date.now()/1000)));
  return this.sessions.issue({provider:'GOOGLE',subject:verified.subject,personId:link.personId,ttlSeconds:ttl});
 }

 async linkGoogle(personId:string,idToken:string){
  const verified=await this.google.verify(idToken);
  const person=await this.db.person.findUnique({where:{personId}});
  if(!person)throw new UnauthorizedException({code:'MEMBER_PERSON_DISABLED'});
  this.eligible(person);
  const existing=await this.db.identityLink.findUnique({where:{provider_providerSubject:{provider:'GOOGLE',providerSubject:verified.subject}}});
  if(existing&&existing.personId!==personId)throw new ConflictException({code:'GOOGLE_IDENTITY_ALREADY_LINKED'});
  if(!existing)await this.db.identityLink.create({data:{personId,provider:'GOOGLE',providerSubject:verified.subject,email:verified.email,displayName:verified.displayName}});
  return {provider:'GOOGLE',linked:true};
 }

 async forgotPassword(identifier:string){
  this.email.assertConfigured();
  const normalized=identifier.trim();
  let person;
  if(normalized.includes('@')){
    const matches=await this.db.person.findMany({where:{email:{equals:normalized,mode:'insensitive'},status:'EFFECTIVE'},take:2});
    person=matches.length===1?matches[0]:undefined;
  }else{
    person=await this.db.person.findFirst({where:{memberNo:normalized,status:'EFFECTIVE'}});
  }
  if(person?.email){
    const now=new Date(),minuteAgo=new Date(now.getTime()-60_000),hourAgo=new Date(now.getTime()-3_600_000);
    const [latest,hourCount]=await Promise.all([
      this.db.passwordResetToken.findFirst({where:{personId:person.personId},orderBy:{createdAt:'desc'}}),
      this.db.passwordResetToken.count({where:{personId:person.personId,createdAt:{gte:hourAgo}}}),
    ]);
    if((latest&&latest.createdAt>=minuteAgo)||hourCount>=5)return {accepted:true};
    const raw=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(raw).digest('hex'),expiresAt=new Date(Date.now()+30*60*1000);
    const reset=await this.db.passwordResetToken.create({data:{personId:person.personId,tokenHash,expiresAt}});
    const base=this.config.get<string>('MEMBER_WEB_PUBLIC_ORIGIN');if(!base)throw new ConflictException({code:'MEMBER_WEB_ORIGIN_NOT_CONFIGURED'});
    try{await this.email.send({to:person.email,resetUrl:`${base.replace(/\/$/,'')}/reset-password?token=${encodeURIComponent(raw)}`});}catch{await this.db.passwordResetToken.update({where:{passwordResetTokenId:reset.passwordResetTokenId},data:{consumedAt:new Date()}});}
  }
  return {accepted:true};
 }

 async resetPassword(token:string,newPassword:string){
  const hash=createHash('sha256').update(token).digest('hex'),now=new Date();
  return this.db.$transaction(async tx=>{
    const rows=await tx.$queryRaw<Array<{id:string;personId:string;expiresAt:Date;consumedAt:Date|null}>>`SELECT password_reset_token_id AS id,person_id AS "personId",expires_at AS "expiresAt",consumed_at AS "consumedAt" FROM identity.password_reset_token WHERE token_hash=${hash} FOR UPDATE`;
    const row=rows[0];if(!row||row.consumedAt||row.expiresAt<=now)throw new UnprocessableEntityException({code:'PASSWORD_RESET_TOKEN_INVALID'});
    const passwordHash=await this.hashPassword(newPassword);
    await tx.memberPasswordCredential.upsert({where:{personId:row.personId},create:{personId:row.personId,passwordHash},update:{passwordHash,passwordChangedAt:now,failedAttemptCount:0,lockedUntil:null,credentialVersion:{increment:1}}});
    await tx.passwordResetToken.update({where:{passwordResetTokenId:row.id},data:{consumedAt:now}});
    await tx.authSession.updateMany({where:{personId:row.personId,roleCode:null,status:'ACTIVE'},data:{status:'REVOKED',revokedAt:now}});
    return {status:'PASSWORD_RESET'};
  });
 }
}
