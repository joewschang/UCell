import {ConflictException,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,SideCode} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {OrganizationService} from '../organization/organization.service';
import {assertQualificationActivation} from './qualification-activation-gate';
type PlacementInput={qualificationId:string;binaryParentQualificationId:string;side:'LEFT'|'RIGHT';reasonCode?:string};

export async function placeDeferredQualification(tx:Prisma.TransactionClient,organization:OrganizationService,audit:AuditService,actorPersonId:string|undefined,placedByType:'SPONSOR_OWNER'|'ADMIN_OVERRIDE'|'SYSTEM_AUTO',input:PlacementInput,requestId:string,bundle:boolean){
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.qualificationId},0))) lock_row`;
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`${input.binaryParentQualificationId}:${input.side}`},0))) lock_row`;
   const setup=await tx.qualificationSetup.findUnique({where:{qualificationId:input.qualificationId}});if(!setup)throw new NotFoundException({code:'QUALIFICATION_SETUP_NOT_FOUND'});
   if(bundle)await assertQualificationActivation(tx,setup);
   if(!['PLACEMENT_PENDING','PLACEMENT_OVERDUE'].includes(setup.setupStatus)||!setup.finalSponsorQualificationId)throw new ConflictException({code:'PLACEMENT_NOT_PENDING'});
   const [qualification,sponsor,parent,sponsorEdge,existingPlacement]=await Promise.all([
    tx.qualification.findUnique({where:{qualificationId:input.qualificationId}}),tx.qualification.findUnique({where:{qualificationId:setup.finalSponsorQualificationId}}),tx.qualification.findUnique({where:{qualificationId:input.binaryParentQualificationId}}),tx.sponsorRelationship.findUnique({where:{childQualificationId:input.qualificationId}}),tx.binaryPlacement.findUnique({where:{childQualificationId:input.qualificationId}})
   ]);
   if(!qualification||!sponsor||!parent)throw new NotFoundException({code:'PLACEMENT_RESOURCE_NOT_FOUND'});
   if(existingPlacement)throw new ConflictException({code:'PLACEMENT_CONFLICT'});
   if(!sponsorEdge||sponsorEdge.sponsorQualificationId!==setup.finalSponsorQualificationId)throw new ConflictException({code:'SPONSOR_CONFIRMATION_MISSING'});
   if(bundle) {
    const membership=await tx.binaryTreeMembership.findUnique({where:{qualificationId:input.binaryParentQualificationId}});
    if(!membership)throw new ConflictException({code:'BINARY_TREE_SCOPE_MISMATCH',message:'請選擇已安置在二元樹的母球。'});
   }
   if(parent.status!=='EFFECTIVE')throw new UnprocessableEntityException({code:'BINARY_PARENT_NOT_ELIGIBLE'});
   const side=input.side as SideCode;await organization.assertBinarySlotAvailable(tx,input.binaryParentQualificationId,side);await organization.assertNoBinaryCycle(tx,input.qualificationId,input.binaryParentQualificationId);await organization.assertFirstThirdLeftRule(tx,setup.finalSponsorQualificationId,sponsorEdge.sponsorSequenceNo,input.binaryParentQualificationId,side);
   const placedAt=new Date(),correlationId=randomUUID(),evidenceBody={qualificationId:input.qualificationId,sponsorQualificationId:setup.finalSponsorQualificationId,binaryParentQualificationId:input.binaryParentQualificationId,side,placedByType,placedByPersonId:actorPersonId??null,placedAt:placedAt.toISOString(),reasonCode:input.reasonCode??null,policyVersion:setup.setupPolicyVersion,previousStatus:setup.setupStatus},evidenceHash=createHash('sha256').update(JSON.stringify(evidenceBody)).digest('hex');
   await organization.createBinaryPlacement(tx,{parentQualificationId:input.binaryParentQualificationId,childQualificationId:input.qualificationId,side,effectiveFrom:placedAt},{sourceType:'DEFERRED_PLACEMENT',actorId:actorPersonId,actorType:placedByType==='SPONSOR_OWNER'?'MEMBER':placedByType==='SYSTEM_AUTO'?'SYSTEM':'ADMIN',correlationId,reason:input.reasonCode??placedByType});
   const evidence=await tx.placementEvidence.create({data:{...evidenceBody,placedAt,placedByPersonId:actorPersonId,reasonCode:input.reasonCode?.trim()||undefined,correlationId,evidenceHash}});
   await tx.qualificationStatusHistory.updateMany({where:{qualificationId:input.qualificationId,effectiveTo:null},data:{effectiveTo:placedAt}});
   const plan=await tx.qualificationPlanHistory.findFirst({where:{qualificationId:input.qualificationId,effectiveTo:null}});
   if(!qualification.planLevelCode)throw new UnprocessableEntityException({code:'QUALIFICATION_PLAN_REQUIRED'});
   if(!plan)await tx.qualificationPlanHistory.create({data:{qualificationId:input.qualificationId,planCode:qualification.planLevelCode,effectiveFrom:placedAt,sourceType:'QUALIFICATION_PLACEMENT',sourceId:evidence.placementEvidenceId}});
   await tx.qualificationSetup.update({where:{qualificationId:input.qualificationId},data:{setupStatus:'PLACED',placedAt}});await tx.qualification.update({where:{qualificationId:input.qualificationId},data:{status:'EFFECTIVE',effectiveAt:placedAt}});await tx.qualificationStatusHistory.create({data:{qualificationId:input.qualificationId,status:'EFFECTIVE',effectiveFrom:placedAt,sourceType:'QUALIFICATION_PLACEMENT',sourceId:evidence.placementEvidenceId}});
   await audit.write(tx,{actorType:placedByType==='ADMIN_OVERRIDE'?'USER':placedByType==='SYSTEM_AUTO'?'SYSTEM':'MEMBER',actorId:actorPersonId,action:'QUALIFICATION_PLACED',entityType:'Qualification',entityId:input.qualificationId,afterData:{...evidenceBody,evidenceHash},requestId,correlationId});await tx.outboxEvent.create({data:{eventType:'QUALIFICATION_PLACED',aggregateType:'Qualification',aggregateId:input.qualificationId,payload:{schemaVersion:1,...evidenceBody,evidenceHash},correlationId}});
   return {placementEvidenceId:evidence.placementEvidenceId,...evidenceBody,evidenceHash};
 }

export async function placePlannedDescendants(tx:Prisma.TransactionClient,organization:OrganizationService,audit:AuditService,descendants:PlacementInput[]|null,requestId:string){
  for (const child of descendants??[]) {
    await placeDeferredQualification(tx,organization,audit,undefined,'SYSTEM_AUTO',{...child,reasonCode:'ENROLLMENT_BUNDLE_LEVEL_ORDER'},requestId,true);
  }
}
