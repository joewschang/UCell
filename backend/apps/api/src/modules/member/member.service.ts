import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdentityTokenService } from '../auth/identity-token.service';
import { LineTokenVerifierService } from '../auth/line-token-verifier.service';
import { QualificationAccessService } from '../auth/qualification-access.service';
@Injectable()
export class MemberService {
 constructor(private readonly db:PrismaService,private readonly verifier:LineTokenVerifierService,private readonly access:QualificationAccessService){}
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
  catch(error){if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'LINE_TOKEN_REPLAYED'});throw error;}
 }
 async me(personId:string){
  const person=await this.db.person.findUniqueOrThrow({where:{personId}});
  return {name:person.preferredName??person.legalName,memberNo:person.personId,email:person.email,phone:person.mobile};
 }
 async profile(personId:string,input:{name?:string;email?:string;phone?:string},requestId:string){
  return this.db.$transaction(async tx=>{
   const before=await tx.person.findUniqueOrThrow({where:{personId}});
   if(before.status!=='EFFECTIVE')throw new UnauthorizedException({code:'MEMBER_PERSON_DISABLED'});
   const after=await tx.person.update({where:{personId},data:{preferredName:input.name,email:input.email,mobile:input.phone}});
   await new AuditService().write(tx,{actorType:'MEMBER',actorId:personId,action:'MEMBER_PROFILE_UPDATED',entityType:'Person',entityId:personId,beforeData:{name:before.preferredName,email:before.email,phone:before.mobile},afterData:{name:after.preferredName,email:after.email,phone:after.mobile},requestId,correlationId:randomUUID()});
   return {name:after.preferredName??after.legalName,memberNo:after.personId,email:after.email,phone:after.mobile};
  },{isolationLevel:'Serializable'});
 }
 async notifications(personId:string,qualificationId:string){
  await this.context(personId,qualificationId);
  return this.db.$transaction(async tx=>{
   await new QualificationAccessService(tx as any).assertHolder(personId,qualificationId);
   const rows=await tx.memberNotification.findMany({where:{personId,OR:[{qualificationId:null},{qualificationId}]},orderBy:[{createdAt:'desc'},{notificationId:'desc'}],take:100});
   return {qualificationId,notices:rows.map(row=>({id:row.notificationId,qualificationId:row.qualificationId,category:row.category,title:row.title,body:row.body,timeLabel:row.createdAt.toISOString()})),pagination:{limit:100,truncated:rows.length===100}};
  },{isolationLevel:'RepeatableRead'});
 }
 async qualifications(personId:string){
  const now=new Date();
  const rows=await this.db.qualification.findMany({where:{currentHolderPersonId:personId,holderHistory:{some:{holderPersonId:personId,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}}},include:{activePeriods:{where:{activeFrom:{lte:now},OR:[{activeTo:null},{activeTo:{gt:now}}]}}},orderBy:{qualificationNo:'asc'}});
  return rows.map(row=>({id:row.qualificationId,code:String(row.qualificationNo),rank:row.planLevelCode,active:row.activePeriods.length>0,ballLabel:'球 '+String(row.qualificationNo)}));
 }
 async context(personId:string,qualificationId:string){
  await this.access.assertHolder(personId,qualificationId);
  const qualification=(await this.qualifications(personId)).find(row=>row.id===qualificationId);
  if(!qualification)throw new ForbiddenException({code:'QUALIFICATION_NOT_OWNED'});
  return {qualificationId,qualification};
 }
}
