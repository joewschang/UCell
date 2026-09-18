import {ConflictException,ForbiddenException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {PrismaService,SideCode} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {OrganizationService} from '../organization/organization.service';

type PlacementInput={qualificationId:string;binaryParentQualificationId:string;side:'LEFT'|'RIGHT';reasonCode?:string};

@Injectable()
export class QualificationPlacementService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService,private readonly organization:OrganizationService){}

 async pendingForSponsorOwner(personId:string,now=new Date()){
  const owned=await this.db.qualification.findMany({where:{currentHolderPersonId:personId},select:{qualificationId:true}}),sponsorIds=owned.map(x=>x.qualificationId);
  const rows=await this.db.qualificationSetup.findMany({where:{setupStatus:{in:['PLACEMENT_PENDING','PLACEMENT_OVERDUE']},finalSponsorQualificationId:{in:sponsorIds}},orderBy:{placementDueAt:'asc'},take:100});
  return rows.map(x=>this.view(x,now));
 }

 async monitor(input:{status?:string;aging?:string;take?:number}={},now=new Date()){
  const take=Math.min(Math.max(Number.isFinite(input.take)?input.take!:50,1),100),rows=await this.db.qualificationSetup.findMany({where:{setupStatus:{in:['PLACEMENT_PENDING','PLACEMENT_OVERDUE','PLACED']}},orderBy:{placementDueAt:'asc'},take:100});
  return rows.map(x=>this.view(x,now)).filter(x=>(!input.status||x.status===input.status)&&(!input.aging||x.agingBucket===input.aging)).slice(0,take);
 }

 async placeBySponsorOwner(personId:string,input:PlacementInput,key:string,requestId:string){return this.place(personId,'SPONSOR_OWNER',input,key,requestId);}
 async placeByAdmin(actorPersonId:string|undefined,input:PlacementInput,key:string,requestId:string){if(!input.reasonCode?.trim())throw new UnprocessableEntityException({code:'PLACEMENT_OVERRIDE_REASON_REQUIRED'});return this.place(actorPersonId,'ADMIN_OVERRIDE',input,key,requestId);}

 async sweepOverdue(actorPersonId:string|undefined,key:string,requestId:string,now=new Date()){
  return this.idempotency.execute(`admin:qualification-placement:sweep:${actorPersonId??'system'}`,key,{asOf:now.toISOString()},async tx=>{
   const due=await tx.qualificationSetup.findMany({where:{setupStatus:'PLACEMENT_PENDING',placementDueAt:{lte:now}},orderBy:{qualificationId:'asc'},take:100});
   for(const row of due){const correlationId=randomUUID();await tx.qualificationSetup.updateMany({where:{qualificationId:row.qualificationId,setupStatus:'PLACEMENT_PENDING'},data:{setupStatus:'PLACEMENT_OVERDUE'}});await tx.placementEscalationEvidence.createMany({data:[{qualificationId:row.qualificationId,dueAt:row.placementDueAt!,escalatedAt:now,escalationType:'OVERDUE_72H',status:'OPEN',assignedAdminId:actorPersonId,correlationId}],skipDuplicates:true});await tx.outboxEvent.create({data:{eventType:'QUALIFICATION_PLACEMENT_OVERDUE',aggregateType:'Qualification',aggregateId:row.qualificationId,payload:{schemaVersion:1,qualificationId:row.qualificationId,dueAt:row.placementDueAt!.toISOString(),escalatedAt:now.toISOString()},correlationId}});}
   return {processed:due.length,asOf:now.toISOString()};
  });
 }

 private async place(actorPersonId:string|undefined,placedByType:'SPONSOR_OWNER'|'ADMIN_OVERRIDE',input:PlacementInput,key:string,requestId:string){
  try{return await this.idempotency.execute(`${placedByType.toLowerCase()}:qualification-placement:${actorPersonId??'system'}`,key,input,async tx=>{
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.qualificationId},0))) lock_row`;
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`${input.binaryParentQualificationId}:${input.side}`},0))) lock_row`;
   const setup=await tx.qualificationSetup.findUnique({where:{qualificationId:input.qualificationId}});if(!setup)throw new NotFoundException({code:'QUALIFICATION_SETUP_NOT_FOUND'});
   if(!['PLACEMENT_PENDING','PLACEMENT_OVERDUE'].includes(setup.setupStatus)||!setup.finalSponsorQualificationId)throw new ConflictException({code:'PLACEMENT_NOT_PENDING'});
   const [qualification,sponsor,parent,sponsorEdge,existingPlacement]=await Promise.all([
    tx.qualification.findUnique({where:{qualificationId:input.qualificationId}}),tx.qualification.findUnique({where:{qualificationId:setup.finalSponsorQualificationId}}),tx.qualification.findUnique({where:{qualificationId:input.binaryParentQualificationId}}),tx.sponsorRelationship.findUnique({where:{childQualificationId:input.qualificationId}}),tx.binaryPlacement.findUnique({where:{childQualificationId:input.qualificationId}})
   ]);
   if(!qualification||!sponsor||!parent)throw new NotFoundException({code:'PLACEMENT_RESOURCE_NOT_FOUND'});
   if(existingPlacement)throw new ConflictException({code:'PLACEMENT_CONFLICT'});
   if(!sponsorEdge||sponsorEdge.sponsorQualificationId!==setup.finalSponsorQualificationId)throw new ConflictException({code:'SPONSOR_CONFIRMATION_MISSING'});
   if(placedByType==='SPONSOR_OWNER'&&sponsor.currentHolderPersonId!==actorPersonId)throw new ForbiddenException({code:'PLACEMENT_AUTHORITY_DENIED'});
   if(parent.status!=='EFFECTIVE')throw new UnprocessableEntityException({code:'BINARY_PARENT_NOT_ELIGIBLE'});
   const side=input.side as SideCode;await this.organization.assertBinarySlotAvailable(tx,input.binaryParentQualificationId,side);await this.organization.assertNoBinaryCycle(tx,input.qualificationId,input.binaryParentQualificationId);await this.organization.assertFirstThirdLeftRule(tx,setup.finalSponsorQualificationId,sponsorEdge.sponsorSequenceNo,input.binaryParentQualificationId,side);
   const placedAt=new Date(),correlationId=randomUUID(),evidenceBody={qualificationId:input.qualificationId,sponsorQualificationId:setup.finalSponsorQualificationId,binaryParentQualificationId:input.binaryParentQualificationId,side,placedByType,placedByPersonId:actorPersonId??null,placedAt:placedAt.toISOString(),reasonCode:input.reasonCode??null,policyVersion:setup.setupPolicyVersion,previousStatus:setup.setupStatus},evidenceHash=createHash('sha256').update(JSON.stringify(evidenceBody)).digest('hex');
   await this.organization.createBinaryPlacement(tx,{parentQualificationId:input.binaryParentQualificationId,childQualificationId:input.qualificationId,side,effectiveFrom:placedAt},{sourceType:'DEFERRED_PLACEMENT',actorId:actorPersonId,actorType:placedByType==='SPONSOR_OWNER'?'MEMBER':'ADMIN',correlationId,reason:input.reasonCode??placedByType});
   const evidence=await tx.placementEvidence.create({data:{...evidenceBody,placedAt,placedByPersonId:actorPersonId,reasonCode:input.reasonCode?.trim()||undefined,correlationId,evidenceHash}});
   await tx.qualificationSetup.update({where:{qualificationId:input.qualificationId},data:{setupStatus:'PLACED',placedAt}});await tx.qualification.update({where:{qualificationId:input.qualificationId},data:{status:'EFFECTIVE',effectiveAt:placedAt}});await tx.qualificationStatusHistory.create({data:{qualificationId:input.qualificationId,status:'EFFECTIVE',effectiveFrom:placedAt,sourceType:'QUALIFICATION_PLACEMENT',sourceId:evidence.placementEvidenceId}});
   await this.audit.write(tx,{actorType:placedByType==='ADMIN_OVERRIDE'?'USER':'MEMBER',actorId:actorPersonId,action:'QUALIFICATION_PLACED',entityType:'Qualification',entityId:input.qualificationId,afterData:{...evidenceBody,evidenceHash},requestId,correlationId});await tx.outboxEvent.create({data:{eventType:'QUALIFICATION_PLACED',aggregateType:'Qualification',aggregateId:input.qualificationId,payload:{schemaVersion:1,...evidenceBody,evidenceHash},correlationId}});
   return {placementEvidenceId:evidence.placementEvidenceId,...evidenceBody,evidenceHash};
  });}catch(error){if(['P2002','P2034'].includes((error as any).code)||((error as any).code==='P2010'&&(error as any).meta?.code==='40001'))throw new ConflictException({code:'PLACEMENT_CONFLICT'});throw error;}
 }

 private view(row:any,now:Date){const status=row.setupStatus==='PLACEMENT_PENDING'&&row.placementDueAt&&row.placementDueAt<=now?'PLACEMENT_OVERDUE':row.setupStatus,ageMs=row.placementRequestedAt?Math.max(0,now.getTime()-row.placementRequestedAt.getTime()):0,h=Math.floor(ageMs/3600000),agingBucket=status==='PLACEMENT_OVERDUE'||h>=72?'OVERDUE':h>=48?'48_72H':h>=24?'24_48H':'0_24H';return {qualificationId:row.qualificationId,ownerPersonId:row.ownerPersonId,packageType:row.packageType,sponsorQualificationId:row.finalSponsorQualificationId,requestedAt:row.placementRequestedAt?.toISOString()??null,dueAt:row.placementDueAt?.toISOString()??null,placedAt:row.placedAt?.toISOString()??null,status,agingBucket,policyVersion:row.setupPolicyVersion};}
}
