import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdentityTokenService } from '../auth/identity-token.service';
import { LineTokenVerifierService } from '../auth/line-token-verifier.service';
import { QualificationAccessService } from '../auth/qualification-access.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
@Injectable()
export class MemberService {
 constructor(private readonly db:PrismaService,private readonly verifier:LineTokenVerifierService,private readonly access:QualificationAccessService,private readonly audit:AuditService){}
 async exchange(idToken:string){
  const identity=await this.verifier.verify(idToken),key=createHash('sha256').update(idToken).digest('hex');
  try{return await this.db.$transaction(async tx=>{
   const binding=await tx.identityLink.findUnique({where:{provider_providerSubject:{provider:'LINE',providerSubject:identity.subject}},include:{person:true}});
   if(!binding)throw new UnauthorizedException({code:'LINE_ACCOUNT_UNBOUND'});
   if(binding.person.status!=='EFFECTIVE')throw new UnauthorizedException({code:'MEMBER_PERSON_DISABLED'});
   await tx.idempotencyRecord.create({data:{actorScope:'member:line:exchange',idempotencyKey:key,requestHash:key,responseBody:{consumed:true},statusCode:200,expiresAt:new Date(identity.expiresAt*1000)}});
   const ttlSeconds=Math.min(3600,identity.expiresAt-Math.floor(Date.now()/1000));
   if(ttlSeconds<=0)throw new UnauthorizedException({code:'LINE_TOKEN_EXPIRED'});
   return new IdentityTokenService(tx as any).issue({provider:'LINE',subject:identity.subject,personId:binding.personId,ttlSeconds});
  },{isolationLevel:'Serializable'});}
  catch(error){if((error as any).code==='P2034')throw new ConflictException({code:'RETRYABLE_CONFLICT',message:'Retry verification with the same unconsumed LINE token.'});if((error as any).code==='P2002')throw new ConflictException({code:'LINE_TOKEN_REPLAYED'});throw error;}
 }
 async me(personId:string){
  const person=await this.db.person.findUniqueOrThrow({where:{personId}});
  return {name:person.preferredName??person.legalName,alias:person.preferredName,memberNo:person.personId,email:person.email,phone:person.mobile,gender:person.genderCode,birthDate:person.birthDate?.toISOString().slice(0,10)??null,membershipState:person.membershipState,mobileVerifiedAt:person.mobileVerifiedAt?.toISOString()??null};
 }
 private async mutation<T>(scope:string,key:string,input:unknown,work:Parameters<IdempotencyService['execute']>[3]){
  try{return await new IdempotencyService(this.db).execute(scope,key,input,work);}
  catch(error){if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT',message:'Retry identical request using same Idempotency-Key.'});throw error;}
 }
 async logout(personId:string,sessionId:string,key:string,requestId:string){
  const result=await this.mutation(`member:logout:${sessionId}`,key,{},async tx=>{
   const changed=await tx.authSession.updateMany({where:{authSessionId:sessionId,personId,provider:'LINE',status:'ACTIVE'},data:{status:'REVOKED',revokedAt:new Date()}});
   if(changed.count)await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'MEMBER_SESSION_REVOKED',entityType:'AuthSession',entityId:sessionId,requestId,correlationId:randomUUID()});
   return {status:'REVOKED',sessionId};
  });return result.value;
 }
 async profile(personId:string,input:{name?:string;email?:string;phone?:string},requestId:string,key:string){
  const result=await this.mutation(`member:profile:${personId}`,key,input,async tx=>{
   const before=await tx.person.findUniqueOrThrow({where:{personId}});
   if(before.status!=='EFFECTIVE')throw new UnauthorizedException({code:'MEMBER_PERSON_DISABLED'});
   const after=await tx.person.update({where:{personId},data:{preferredName:input.name,email:input.email,mobile:input.phone}});
   await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'MEMBER_PROFILE_UPDATED',entityType:'Person',entityId:personId,beforeData:{name:before.preferredName,email:before.email,phone:before.mobile},afterData:{name:after.preferredName,email:after.email,phone:after.mobile},requestId,correlationId:randomUUID()});
   return {name:after.preferredName??after.legalName,alias:after.preferredName,memberNo:after.personId,email:after.email,phone:after.mobile,gender:after.genderCode,birthDate:after.birthDate?.toISOString().slice(0,10)??null,membershipState:after.membershipState,mobileVerifiedAt:after.mobileVerifiedAt?.toISOString()??null};
  });return result.value;
 }
 async markNotificationRead(personId:string,qualificationId:string,notificationId:string,key:string,requestId:string){
  await this.context(personId,qualificationId);
  const result=await this.mutation(`member:notification:read:${personId}`,key,{qualificationId,notificationId},async tx=>{
   await new QualificationAccessService(tx as any).assertHolder(personId,qualificationId);
   const notice=await tx.memberNotification.findFirst({where:{notificationId,personId,OR:[{qualificationId:null},{qualificationId}]}});
   if(!notice)throw new NotFoundException({code:'NOTIFICATION_NOT_FOUND'});
   const existing=await tx.memberNotificationRead.findUnique({where:{notificationId_personId:{notificationId,personId}}});
   const read=existing??await tx.memberNotificationRead.create({data:{notificationId,personId}});
   if(!existing)await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'MEMBER_NOTIFICATION_READ',entityType:'MemberNotification',entityId:notificationId,requestId,correlationId:randomUUID()});
   return {qualificationId,notificationId,readAt:read.readAt.toISOString()};
  });return result.value;
 }
 async notifications(personId:string,qualificationId:string){
  await this.context(personId,qualificationId);
  return this.db.$transaction(async tx=>{
   await new QualificationAccessService(tx as any).assertHolder(personId,qualificationId);
   const rows=await tx.memberNotification.findMany({where:{personId,OR:[{qualificationId:null},{qualificationId}]},include:{reads:{where:{personId}}},orderBy:[{createdAt:'desc'},{notificationId:'desc'}],take:100});
   return {qualificationId,notices:rows.map(row=>({id:row.notificationId,qualificationId:row.qualificationId,category:row.category,title:row.title,body:row.body,timeLabel:row.createdAt.toISOString(),readAt:row.reads[0]?.readAt.toISOString()??null})),pagination:{limit:100,truncated:rows.length===100}};
  },{isolationLevel:'RepeatableRead'});
 }
 async qualifications(personId:string){
  const now=new Date();
  const rows=await this.db.qualification.findMany({where:{currentHolderPersonId:personId,holderHistory:{some:{holderPersonId:personId,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}}},include:{activePeriods:{where:{activeFrom:{lte:now},OR:[{activeTo:null},{activeTo:{gt:now}}]}}},orderBy:{qualificationNo:'asc'}});
  const monthReference=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).format(now);
  const evidence=await this.db.activeIntervalEvidence.findMany({where:{qualificationId:{in:rows.map(row=>row.qualificationId)},calendarMonth:new Date(monthReference+'-01')},orderBy:{createdAt:'desc'}});
  const latest=new Map<string,typeof evidence[number]>();for(const row of evidence)if(!latest.has(row.qualificationId))latest.set(row.qualificationId,row);
  return rows.map(row=>{const interval=latest.get(row.qualificationId);return {id:row.qualificationId,code:String(row.qualificationNo),rank:row.planLevelCode,active:!!interval&&interval.activeFrom<=now&&interval.activeTo>now,ballLabel:'球 '+String(row.qualificationNo),monthReference,activeInterval:interval?{activeFrom:interval.activeFrom.toISOString(),activeTo:interval.activeTo.toISOString()}:null};});
 }
 async context(personId:string,qualificationId:string){
  await this.access.assertHolder(personId,qualificationId);
  const qualification=(await this.qualifications(personId)).find(row=>row.id===qualificationId);
  if(!qualification)throw new ForbiddenException({code:'QUALIFICATION_NOT_OWNED'});
  return {qualificationId,qualification};
 }
}
