import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,SideCode} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {OrganizationService} from '../organization/organization.service';

@Injectable()
export class SystemAssignmentService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService,private readonly organization:OrganizationService){}
 async create(input:{personId:string;planLevelCode:'STARTER'|'ELITE'|'LEADER';policyVersion:string;effectiveAt?:string},key:string,requestId:string,actorId?:string,now=new Date()){
  try{return await this.idempotency.execute(`admin:qualification:system-assignment:${actorId??'system'}`,key,input,async tx=>{
   await tx.$queryRaw`SELECT true FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.policyVersion},0))) lock_row`;
   const effectiveAt=input.effectiveAt?new Date(input.effectiveAt):now;
   const [person,policy,attribution]=await Promise.all([
    tx.person.findUnique({where:{personId:input.personId}}),
    tx.systemAssignmentPolicy.findUnique({where:{version:input.policyVersion},include:{poolEntries:{where:{eligibilityState:'ELIGIBLE',enabledFrom:{lte:effectiveAt},OR:[{enabledTo:null},{enabledTo:{gt:effectiveAt}}]}}}}),
    tx.referralAttribution.findFirst({where:{personId:input.personId,status:'ACTIVE',lockedUntil:{gt:effectiveAt}}})
   ]);
   if(!person||person.status!=='EFFECTIVE')throw new ConflictException({code:'PERSON_NOT_ELIGIBLE'});
   if(attribution)throw new ConflictException({code:'VALID_REFERRAL_ATTRIBUTION_EXISTS'});
   if(!policy||policy.status!=='ACTIVE'||policy.effectiveFrom>effectiveAt||(policy.effectiveTo&&policy.effectiveTo<=effectiveAt))throw new UnprocessableEntityException({code:'SYSTEM_ASSIGNMENT_POLICY_MISSING'});
   if(policy.poolSelector!=='EXPLICIT_VERSIONED_POOL'||policy.tieBreakStrategy!=='DESCENDANT_COUNT_PRIORITY_ENABLED_UUID'||policy.capacityPolicy!=='HARD_DESCENDANT_LIMIT'||policy.exclusionPolicy!=='EFFECTIVE_QUALIFICATION_ONLY'||policy.lockStrategy!=='POLICY_ADVISORY_REVALIDATE')throw new UnprocessableEntityException({code:'SYSTEM_ASSIGNMENT_POLICY_UNSUPPORTED'});
   const candidates=[] as Array<any>;
   for(const entry of policy.poolEntries){const root=await tx.qualification.findUnique({where:{qualificationId:entry.qualificationId}});if(!root||root.status!=='EFFECTIVE')continue;const count=await this.descendantCount(tx,entry.qualificationId);if(entry.capacityLimit!==null&&count>=entry.capacityLimit)continue;candidates.push({entry,count});}
   candidates.sort((a,b)=>a.count-b.count||a.entry.priorityClass-b.entry.priorityClass||a.entry.enabledFrom.getTime()-b.entry.enabledFrom.getTime()||a.entry.qualificationId.localeCompare(b.entry.qualificationId));
   const selected=candidates[0];if(!selected)throw new UnprocessableEntityException({code:'SYSTEM_ASSIGNMENT_POOL_EXHAUSTED'});
   const slot=await this.firstSlot(tx,selected.entry.qualificationId);if(!slot)throw new UnprocessableEntityException({code:'SYSTEM_ASSIGNMENT_POOL_EXHAUSTED'});
   const sponsorSequenceNo=await this.organization.allocateSponsorSequence(tx,selected.entry.qualificationId);
   await this.organization.assertBinarySlotAvailable(tx,slot.parentQualificationId,slot.side);await this.organization.assertFirstThirdLeftRule(tx,selected.entry.qualificationId,sponsorSequenceNo,slot.parentQualificationId,slot.side);
   const qualification=await tx.qualification.create({data:{currentHolderPersonId:input.personId,planLevelCode:input.planLevelCode,status:'EFFECTIVE',effectiveAt}});
   await tx.qualificationPlanHistory.create({data:{qualificationId:qualification.qualificationId,planCode:input.planLevelCode,effectiveFrom:effectiveAt,sourceType:'SYSTEM_ASSIGNMENT'}});await tx.qualificationHolderHistory.create({data:{qualificationId:qualification.qualificationId,holderPersonId:input.personId,effectiveFrom:effectiveAt,sourceType:'SYSTEM_ASSIGNMENT'}});await tx.qualificationStatusHistory.create({data:{qualificationId:qualification.qualificationId,status:'EFFECTIVE',effectiveFrom:effectiveAt,sourceType:'SYSTEM_ASSIGNMENT'}});
   await tx.sponsorRelationship.create({data:{sponsorQualificationId:selected.entry.qualificationId,childQualificationId:qualification.qualificationId,sponsorSequenceNo,effectiveFrom:effectiveAt}});await tx.binaryPlacement.create({data:{parentQualificationId:slot.parentQualificationId,childQualificationId:qualification.qualificationId,side:slot.side,effectiveFrom:effectiveAt}});
   const correlationId=randomUUID(),evidence=await tx.systemAssignmentEvidence.create({data:{systemAssignmentPolicyId:policy.systemAssignmentPolicyId,childQualificationId:qualification.qualificationId,selectedRootQualificationId:selected.entry.qualificationId,binaryParentQualificationId:slot.parentQualificationId,binarySide:slot.side,rootDescendantCount:selected.count,policyVersion:policy.version,policyHash:policy.configHash,inputEvidence:{personId:input.personId,candidateCount:candidates.length,noValidReferral:true},outputEvidence:{sponsorSequenceNo,binarySide:slot.side},correlationId,executedAt:effectiveAt}});
   await this.audit.write(tx,{actorType:actorId?'USER':'SYSTEM',actorId,action:'SYSTEM_QUALIFICATION_ASSIGNED',entityType:'Qualification',entityId:qualification.qualificationId,afterData:{policyVersion:policy.version,policyHash:policy.configHash,selectedRootQualificationId:selected.entry.qualificationId,binaryParentQualificationId:slot.parentQualificationId,binarySide:slot.side},requestId,correlationId});
   return {qualification,systemAssignmentEvidenceId:evidence.systemAssignmentEvidenceId,sponsorQualificationId:selected.entry.qualificationId,binaryParentQualificationId:slot.parentQualificationId,binarySide:slot.side,policyVersion:policy.version,policyHash:policy.configHash};
  });}catch(error){if(['P2002','P2034'].includes((error as any).code)||((error as any).code==='P2010'&&(error as any).meta?.code==='40001'))throw new ConflictException({code:'RETRYABLE_CONFLICT'});throw error;}
 }
 private async descendantCount(tx:Prisma.TransactionClient,root:string){const rows=await tx.$queryRaw<Array<{count:bigint}>>`WITH RECURSIVE tree(id) AS (SELECT ${root}::uuid UNION ALL SELECT bp.child_qualification_id FROM organization.binary_placement bp JOIN tree t ON bp.parent_qualification_id=t.id WHERE bp.effective_to IS NULL) SELECT (count(*)-1)::bigint count FROM tree`;return Number(rows[0]?.count??0);}
 private async firstSlot(tx:Prisma.TransactionClient,root:string){const rows=await tx.$queryRaw<Array<{parent_qualification_id:string;left_id:string|null;right_id:string|null}>>`WITH RECURSIVE tree(id,depth,path) AS (SELECT ${root}::uuid,0,ARRAY[]::integer[] UNION ALL SELECT bp.child_qualification_id,t.depth+1,t.path||CASE WHEN bp.side='LEFT'::organization."SideCode" THEN 0 ELSE 1 END FROM organization.binary_placement bp JOIN tree t ON bp.parent_qualification_id=t.id WHERE bp.effective_to IS NULL) SELECT t.id parent_qualification_id,l.child_qualification_id left_id,r.child_qualification_id right_id FROM tree t LEFT JOIN organization.binary_placement l ON l.parent_qualification_id=t.id AND l.side='LEFT' AND l.effective_to IS NULL LEFT JOIN organization.binary_placement r ON r.parent_qualification_id=t.id AND r.side='RIGHT' AND r.effective_to IS NULL WHERE l.child_qualification_id IS NULL OR r.child_qualification_id IS NULL ORDER BY t.depth,t.path LIMIT 1`;const row=rows[0];return row?{parentQualificationId:row.parent_qualification_id,side:row.left_id?SideCode.RIGHT:SideCode.LEFT}:null;}
}
