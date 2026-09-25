import {ConflictException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,childPosition} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
export type TreePlacementMeta={sourceType:string;actorId?:string;actorType?:'ADMIN'|'MEMBER'|'SYSTEM';reason?:string;correlationId?:string};
export const treeHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Shared by every application Binary writer. No Sponsor mutation, money calculation or hidden position choice. */
export async function attachTreePlacement(tx:Prisma.TransactionClient,data:{parentQualificationId:string;childQualificationId:string;side:'LEFT'|'RIGHT';effectiveFrom:Date},meta:TreePlacementMeta){
 const parent=await tx.binaryTreeMembership.findUnique({where:{qualificationId:data.parentQualificationId}});
 if(!parent){
  if(await tx.binaryTreeMembership.findUnique({where:{qualificationId:data.childQualificationId}}))throw new ConflictException({code:'BINARY_TREE_SCOPE_MISMATCH'});
  return null;
 }
 await tx.$queryRaw`SELECT binary_tree_id FROM organization.binary_tree WHERE binary_tree_id=${parent.binaryTreeId}::uuid FOR UPDATE`;
 await tx.$queryRaw`SELECT qualification_id FROM membership.qualification WHERE qualification_id=${data.childQualificationId}::uuid FOR UPDATE`;
 const tree=await tx.binaryTree.findUniqueOrThrow({where:{binaryTreeId:parent.binaryTreeId}});
 if(tree.status!=='ACTIVE')throw new ConflictException({code:'TREE_NOT_OPEN_TO_PLACEMENT'});
 if(!meta.actorId && meta.actorType!=='SYSTEM')throw new UnprocessableEntityException({code:'TREE_ACTOR_REQUIRED'});
 if(parent.effectiveFrom>data.effectiveFrom || Math.abs(Date.now()-data.effectiveFrom.getTime())>10000)throw new UnprocessableEntityException({code:'TREE_EFFECTIVE_TIME_UNSUPPORTED'});
 const q=await tx.qualification.findUniqueOrThrow({where:{qualificationId:data.childQualificationId}});
 if(q.kind==='COMPANY_BOOTSTRAP')throw new ConflictException({code:'BOOTSTRAP_QUALIFICATION_LOCKED'});
 if(!q.currentHolderPersonId || !q.planLevelCode)throw new UnprocessableEntityException({code:'MEMBER_OWNER_EVIDENCE_REQUIRED'});
 if(await tx.binaryTreeMembership.findUnique({where:{qualificationId:q.qualificationId}}))throw new ConflictException({code:'QUALIFICATION_ALREADY_IN_TREE'});
 const history=await tx.qualificationHolderHistory.findMany({where:{qualificationId:q.qualificationId,effectiveFrom:{lte:data.effectiveFrom},OR:[{effectiveTo:null},{effectiveTo:{gt:data.effectiveFrom}}]},take:2});
 if(history.length!==1 || history[0].holderPersonId!==q.currentHolderPersonId)throw new UnprocessableEntityException({code:'MEMBER_OWNER_EVIDENCE_REQUIRED'});
 const owner=await tx.qualificationOwnerInterval.findFirst({where:{qualificationId:q.qualificationId,effectiveTo:null}});
 if(owner && (owner.ownerType!=='MEMBER' || owner.personId!==q.currentHolderPersonId))throw new ConflictException({code:'OWNER_EVIDENCE_CONFLICT'});
 if(!owner)await tx.qualificationOwnerInterval.create({data:{qualificationId:q.qualificationId,ownerType:'MEMBER',personId:q.currentHolderPersonId,effectiveFrom:history[0].effectiveFrom,
  sourceType:'HOLDER_HISTORY_IMPORT',sourceId:history[0].holderHistoryId,evidenceHash:treeHash({holderHistoryId:history[0].holderHistoryId,personId:q.currentHolderPersonId,effectiveFrom:history[0].effectiveFrom.toISOString()})}});
 const positions=await tx.treeCanonicalPosition.findMany({where:{binaryTreeId:tree.binaryTreeId}});
 const parentMembership=await tx.binaryTreeMembership.findUniqueOrThrow({where:{qualificationId:data.parentQualificationId}});
 const binaryPositionNo=childPosition(parentMembership.binaryPositionNo,data.side);
 const parentPosition=positions.find(p=>p.occupantQualificationId===data.parentQualificationId);
 const position=parentPosition?positions.find(p=>p.parentPositionNo===parentPosition.positionNo && p.side===data.side):undefined;
 const sponsor=await tx.sponsorRelationship.findUnique({where:{childQualificationId:q.qualificationId}});
 if(!sponsor || sponsor.effectiveFrom>data.effectiveFrom || (sponsor.effectiveTo && sponsor.effectiveTo<=data.effectiveFrom))throw new ConflictException({code:'SPONSOR_CONFIRMATION_MISSING'});
 const designation=await tx.companySponsorDesignation.findUniqueOrThrow({where:{binaryTreeId:tree.binaryTreeId}});
 if(position && (position.positionNo<4 || position.occupantQualificationId))throw new ConflictException({code:'BINARY_SLOT_OCCUPIED'});
 if(position && sponsor.sponsorQualificationId!==designation.qualificationId)throw new ConflictException({code:'FOUNDING_COMPANY_SPONSOR_REQUIRED'});
 const [{ballNo}]=await tx.$queryRaw<Array<{ballNo:string}>>`SELECT organization.allocate_ball_no(${tree.binaryTreeId}::uuid,${q.qualificationId}::uuid) AS "ballNo"`;
 const id=randomUUID(),correlationId=meta.correlationId??randomUUID(),version=tree.topologyVersion+1;
 const body={binaryTreeId:tree.binaryTreeId,qualificationId:q.qualificationId,parentQualificationId:data.parentQualificationId,side:data.side,binaryPositionNo:binaryPositionNo.toString(),ballNo,effectiveAt:data.effectiveFrom.toISOString(),topologyVersion:version,sourceType:meta.sourceType};
 const evidenceHash=treeHash(body);
 await tx.placementTreeEvidence.create({data:{placementTreeEvidenceId:id,binaryTreeId:tree.binaryTreeId,qualificationId:q.qualificationId,parentQualificationId:data.parentQualificationId,side:data.side,
  binaryPositionNo,placementKind:'PLACEMENT',sourceType:meta.sourceType,actorType:meta.actorType??'ADMIN',actorId:meta.actorId,reason:meta.reason?.trim()||meta.sourceType,effectiveAt:data.effectiveFrom,topologyVersion:version,correlationId,evidenceHash}});
 await tx.binaryTreeMembership.create({data:{qualificationId:q.qualificationId,binaryTreeId:tree.binaryTreeId,binaryPositionNo,effectiveFrom:data.effectiveFrom,placementTreeEvidenceId:id}});
 await tx.qualification.update({where:{qualificationId:q.qualificationId},data:{ballNo}});
 if(position){
  await tx.treeCanonicalPosition.update({where:{binaryTreeId_positionNo:{binaryTreeId:tree.binaryTreeId,positionNo:position.positionNo}},data:{occupantQualificationId:q.qualificationId,occupiedAt:data.effectiveFrom}});
  await tx.foundingOccupationEvidence.create({data:{binaryTreeId:tree.binaryTreeId,positionNo:position.positionNo,qualificationId:q.qualificationId,initialPersonId:q.currentHolderPersonId,
   companySponsorQualificationId:designation.qualificationId,sponsorRelationshipId:sponsor.sponsorRelationshipId,actualSponsorSequenceNo:sponsor.sponsorSequenceNo,effectiveAt:data.effectiveFrom,evidenceHash}});
 }
 // Canonical roots #1–#7 support complete tree/founding statistics. Keep self only as
 // the insertion proof; arbitrary parent expansion uses immutable placement edges.
 // This bounds new ancestry storage independently of pathological tree depth.
 const canonicalIds=positions.flatMap(p=>p.occupantQualificationId?[p.occupantQualificationId]:[]);
 const ancestors=await tx.binaryTreeAncestry.findMany({where:{binaryTreeId:tree.binaryTreeId,descendantQualificationId:data.parentQualificationId,ancestorQualificationId:{in:[...canonicalIds,data.parentQualificationId]}}});
 if(!ancestors.some(a=>a.depth===0 && a.ancestorQualificationId===data.parentQualificationId))throw new ConflictException({code:'TREE_PROJECTION_UNAVAILABLE'});
 if(ancestors.some(a=>a.ancestorQualificationId===q.qualificationId))throw new ConflictException({code:'BINARY_CYCLE'});
 await tx.binaryTreeAncestry.createMany({data:[{binaryTreeId:tree.binaryTreeId,ancestorQualificationId:q.qualificationId,descendantQualificationId:q.qualificationId,depth:0,firstSide:null,effectiveFrom:data.effectiveFrom},
  ...ancestors.filter(a=>canonicalIds.includes(a.ancestorQualificationId)).map(a=>({binaryTreeId:tree.binaryTreeId,ancestorQualificationId:a.ancestorQualificationId,descendantQualificationId:q.qualificationId,depth:a.depth+1,firstSide:a.depth===0?data.side:a.firstSide,effectiveFrom:data.effectiveFrom}))]});
 await tx.binaryTree.update({where:{binaryTreeId:tree.binaryTreeId},data:{topologyVersion:version}});
 await tx.binaryTreeProjectionCheckpoint.update({where:{binaryTreeId:tree.binaryTreeId},data:{sourceVersion:version,dataThrough:data.effectiveFrom,recordedAt:new Date(),status:'READY'}});
 await tx.auditEvent.create({data:{actorType:meta.actorType??'ADMIN',actorId:meta.actorId,action:'TREE_QUALIFICATION_PLACED',entityType:'BinaryTree',entityId:tree.binaryTreeId,afterData:{...body,evidenceHash},requestId:correlationId,correlationId}});
 await tx.outboxEvent.create({data:{eventType:'BINARY_TREE_CHANGED',aggregateType:'BinaryTree',aggregateId:tree.binaryTreeId,payload:{schemaVersion:1,binaryTreeId:tree.binaryTreeId,topologyVersion:version,evidenceHash},correlationId}});
 return {binaryTreeId:tree.binaryTreeId,topologyVersion:version,placementTreeEvidenceId:id,evidenceHash};
}
