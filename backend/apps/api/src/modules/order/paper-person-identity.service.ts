import {ConflictException, Injectable, ServiceUnavailableException, UnprocessableEntityException} from '@nestjs/common';
import {createHmac, randomUUID} from 'node:crypto';
import {Prisma, PrismaService} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';

const ALGORITHM='HMAC-SHA-256', VERSION='v1';
type Policy={country:string;type:string;pattern:string;allowedSeparators?:string};
type Input={paperApplicationNo:string;legalName:string;birthDate?:string;mobile?:string;email?:string;documentCountry:string;documentType:string;documentNo:string;evidenceDocumentRef?:string;receivedAt:string;actorId:string;requestId:string};
@Injectable()
export class PaperPersonIdentityService {
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 private policy(country:string,type:string){
  let policies:Policy[]=[];try{policies=JSON.parse(process.env.PAPER_IDENTITY_DOCUMENT_POLICIES??'[]');}catch{throw new ServiceUnavailableException({code:'PAPER_IDENTITY_POLICY_CONFIGURATION_PENDING'});}
  const policy=policies.find(p=>p.country===country&&p.type===type);
  if(!policy||typeof policy.pattern!=='string')throw new UnprocessableEntityException({code:'INSUFFICIENT_OR_INVALID_IDENTITY',message:'Document country/type requires approved normalization policy'});
  return policy;
 }
 private fingerprint(input:Pick<Input,'documentCountry'|'documentType'|'documentNo'>){
  const country=input.documentCountry.trim().toUpperCase(),type=input.documentType.trim().toUpperCase();
  if(!country||!type||!input.documentNo?.trim())throw new UnprocessableEntityException({code:'INSUFFICIENT_OR_INVALID_IDENTITY'});
  const policy=this.policy(country,type);let documentNo=input.documentNo.trim();
  if(policy.allowedSeparators){const escaped=policy.allowedSeparators.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');documentNo=documentNo.replace(new RegExp(`[${escaped}\\s]`,'g'),'');}
  documentNo=documentNo.toUpperCase();
  let matcher:RegExp;try{matcher=new RegExp(policy.pattern);}catch{throw new ServiceUnavailableException({code:'PAPER_IDENTITY_POLICY_CONFIGURATION_PENDING'});}
  if(!matcher.test(documentNo))throw new UnprocessableEntityException({code:'INSUFFICIENT_OR_INVALID_IDENTITY'});
  const secret=process.env.PAPER_IDENTITY_HMAC_KEY_V1;if(!secret||secret.length<32)throw new ServiceUnavailableException({code:'PAPER_IDENTITY_CONFIGURATION_PENDING'});
  const canonical=`PAPER_PERSON_IDENTITY:${VERSION}:${country}:${type}:${documentNo}`;
  return {country,type,fingerprint:createHmac('sha256',secret).update(canonical).digest('hex')};
 }
 private duplicateWhere(input:Input):Prisma.PersonWhereInput|undefined{
  const or:Prisma.PersonWhereInput[]=[];
  if(input.mobile?.trim())or.push({mobile:input.mobile.trim()});
  if(input.email?.trim())or.push({email:input.email.trim().toLowerCase()});
  if(input.birthDate&&input.legalName.trim())or.push({AND:[{legalName:input.legalName.trim()},{birthDate:new Date(input.birthDate)}]});
  return or.length?{OR:or}:undefined;
 }
 async createOrReuse(tx:Prisma.TransactionClient,input:Input){
  const identity=this.fingerprint(input), now=new Date(input.receivedAt);
  const exact=await tx.paperPersonIdentityFingerprint.findUnique({where:{fingerprintAlgorithm_fingerprintVersion_fingerprint:{fingerprintAlgorithm:ALGORITHM,fingerprintVersion:VERSION,fingerprint:identity.fingerprint}},include:{person:{select:{personId:true,memberNo:true,birthDate:true}}}});
  await this.audit.write(tx,{actorType:'USER',actorId:input.actorId,action:'PAPER_IDENTITY_CHECKED',entityType:'PaperApplication',afterData:{paperApplicationNo:input.paperApplicationNo,matchOutcome:exact?'EXACT_MATCH':'CHECKED',fingerprintAlgorithm:ALGORITHM,fingerprintVersion:VERSION},requestId:input.requestId,correlationId:randomUUID()});
  if(exact){
   if(input.birthDate&&exact.person.birthDate&&exact.person.birthDate.getTime()!==new Date(input.birthDate).getTime())return this.review(tx,input,identity,'CORROBORATING_IDENTITY_CONFLICT');
   await this.audit.write(tx,{actorType:'USER',actorId:input.actorId,action:'PAPER_EXISTING_PERSON_MATCHED',entityType:'Person',entityId:exact.person.personId,afterData:{paperApplicationNo:input.paperApplicationNo,memberNo:exact.person.memberNo,matchOutcome:'EXACT_MATCH'},requestId:input.requestId,correlationId:randomUUID()});
   return {outcome:'EXACT_MATCH' as const,person:exact.person};
  }
  const possible=await tx.person.findFirst({where:this.duplicateWhere(input),select:{personId:true,memberNo:true}});
  if(possible)return this.review(tx,input,identity,'SECONDARY_DUPLICATE_SIGNAL');
  const person=await tx.person.create({data:{legalName:input.legalName.trim(),birthDate:input.birthDate?new Date(input.birthDate):undefined,mobile:input.mobile?.trim()||undefined,email:input.email?.trim().toLowerCase()||undefined,status:'DRAFT'}});
  try{await tx.paperPersonIdentityFingerprint.create({data:{personId:person.personId,documentCountry:identity.country,documentType:identity.type,fingerprintAlgorithm:ALGORITHM,fingerprintVersion:VERSION,fingerprint:identity.fingerprint}});}catch(error:any){if(error?.code==='P2002')throw new ConflictException({code:'PAPER_IDENTITY_CONCURRENT_RETRY_REQUIRED'});throw error;}
  await this.audit.write(tx,{actorType:'USER',actorId:input.actorId,action:'PAPER_NEW_PERSON_CREATED',entityType:'Person',entityId:person.personId,afterData:{paperApplicationNo:input.paperApplicationNo,memberNo:person.memberNo,matchOutcome:'NO_MATCH'},requestId:input.requestId,correlationId:randomUUID()});
  return {outcome:'NO_MATCH' as const,person};
 }
 private async review(tx:Prisma.TransactionClient,input:Input,identity:{fingerprint:string},reasonCode:string){
  const review=await tx.paperIdentityDuplicateReview.upsert({where:{paperApplicationNo:input.paperApplicationNo},create:{paperApplicationNo:input.paperApplicationNo,fingerprintAlgorithm:ALGORITHM,fingerprintVersion:VERSION,fingerprint:identity.fingerprint,reasonCode,evidenceDocumentRef:input.evidenceDocumentRef,requestedBy:input.actorId},update:{}});
  await this.audit.write(tx,{actorType:'USER',actorId:input.actorId,action:'PAPER_DUPLICATE_REVIEW_REQUIRED',entityType:'PaperIdentityDuplicateReview',entityId:review.paperIdentityDuplicateReviewId,afterData:{paperApplicationNo:input.paperApplicationNo,status:review.status,reasonCode},requestId:input.requestId,correlationId:randomUUID()});
  return {outcome:'POSSIBLE_DUPLICATE' as const,reviewId:review.paperIdentityDuplicateReviewId};
 }
}
