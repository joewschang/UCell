import {ConflictException,ForbiddenException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {binaryPath,Prisma,PrismaService,ballNoFor,childPosition,bindCompanyLeaderProfile,effectiveCompanyParameters} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {OrganizationService} from '../organization/organization.service';
import {treeHash} from '../organization/tree-placement';
import {authorizeTreePrincipal,TreePrincipal} from './tree-authorization';
export type {TreePrincipal} from './tree-authorization';
const manageRoles=['SUPER_ADMIN'];
const sponsorRoles=['SUPER_ADMIN','MEMBERSHIP_OPS'];
const placementRoles=['SUPER_ADMIN','QUALIFICATION_PLACEMENT_OVERRIDE'];
const writeRoles=[...new Set([...manageRoles,...sponsorRoles,...placementRoles])];
const readRoles=[...writeRoles,'COMPLIANCE_AUDIT'];
@Injectable()
export class BinaryTreeService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly organization:OrganizationService){}
 async authorize(p:TreePrincipal,write=false,tx?:Prisma.TransactionClient){return authorizeTreePrincipal(this.db,p,write?writeRoles:readRoles,tx);}
 async resolveTreeBall(p:TreePrincipal,treeId:string,ballNo:string){
  await this.authorize(p);
  const ball=await this.db.qualification.findUnique({where:{ballNo},include:{binaryTreeMembership:true}});
  if(!ball?.binaryTreeMembership||ball.binaryTreeMembership.binaryTreeId!==treeId)throw new ConflictException({code:'BINARY_TREE_SCOPE_MISMATCH'});
  return ball.qualificationId;
 }
 async resolveUnplacedMemberQualification(p:TreePrincipal,memberNo:string){
  await this.authorize(p,true);
  const matches=await this.db.qualification.findMany({where:{kind:'MEMBER_ORIGIN',currentHolder:{memberNo},binaryTreeMembership:null},select:{qualificationId:true},take:2});
  if(matches.length!==1)throw new ConflictException({code:matches.length?'MEMBER_NO_QUALIFICATION_AMBIGUOUS':'UNPLACED_MEMBER_QUALIFICATION_REQUIRED'});
  return matches[0].qualificationId;
 }
 private async command<T>(p:TreePrincipal,scope:string,key:string,body:unknown,work:(tx:Prisma.TransactionClient,actorId:string)=>Promise<T>){
  const actor=await this.authorize(p,true);
  if(!(scope.startsWith('place:')?placementRoles:scope.startsWith('confirm-sponsor:')?sponsorRoles:manageRoles).includes(p.role))throw new ForbiddenException({code:'TREE_COMMAND_ROLE_DENIED'});
  if(typeof key!=='string'||key.length<8||key.length>128)throw new UnprocessableEntityException({code:'IDEMPOTENCY_KEY_REQUIRED'});
  for(let attempt=0;;attempt++)try{return await this.idempotency.execute(`tree:${scope}:${actor}`,key,body,async tx=>{await this.authorize(p,true,tx);const result=await work(tx,actor);await this.authorize(p,true,tx);return result;});}
  catch(error){if(['P2034','P2002'].includes((error as any).code)&&attempt<2)continue;if(['P2034','P2002'].includes((error as any).code))throw new ConflictException({code:'TREE_COMMAND_CONFLICT'});throw error;}
 }
 private effective(value?:string){const now=new Date();if(value!==undefined&&(!Number.isFinite(Date.parse(value))||Math.abs(Date.parse(value)-now.getTime())>10000))throw new UnprocessableEntityException({code:'TREE_EFFECTIVE_TIME_UNSUPPORTED'});return now;}
 private reason(value:string){if(typeof value!=='string'||!value.trim()||value.length>500)throw new UnprocessableEntityException({code:'TREE_REASON_REQUIRED'});return value.trim();}
 async create(p:TreePrincipal,input:{treeName:string;treeCode?:string;reason:string;effectiveAt?:string},key:string){
  return this.command(p,'create',key,input,async(tx,actorId)=>{
   const reason=this.reason(input.reason),at=this.effective(input.effectiveAt);
   if(typeof input.treeName!=='string'||!input.treeName.trim()||input.treeName.trim().length>120)throw new UnprocessableEntityException({code:'TREE_NAME_INVALID'});
   const treeCode=input.treeCode??'TREE-'+randomUUID().slice(0,8).toUpperCase();if(!/^[A-Z][A-Z0-9_-]{0,39}$/.test(treeCode))throw new UnprocessableEntityException({code:'TREE_CODE_INVALID'});
   const company=await tx.companyPrincipal.findUnique({where:{code:'UCELL_COMPANY'}});if(company?.status!=='ACTIVE')throw new ConflictException({code:'COMPANY_PRINCIPAL_UNAVAILABLE'});
   if(await tx.binaryTree.findUnique({where:{treeCode}}))throw new ConflictException({code:'TREE_CODE_ALREADY_USED'});
   const treeId=randomUUID(),correlationId=randomUUID(),balls=[randomUUID(),randomUUID(),randomUUID()];
   const tree=await tx.binaryTree.create({data:{binaryTreeId:treeId,treeCode,treeName:input.treeName.trim(),companyPrincipalId:company.companyPrincipalId,createdByActorId:actorId,effectiveAt:at}});
   for(let i=0;i<3;i++){
    const binaryPositionNo=BigInt(i+1),ballNo=ballNoFor(treeCode,binaryPositionNo);
    await tx.qualification.create({data:{qualificationId:balls[i],kind:'COMPANY_BOOTSTRAP',currentCompanyPrincipalId:company.companyPrincipalId,currentHolderPersonId:null,planLevelCode:null,status:'EFFECTIVE',activeFlag:false,effectiveAt:at}});
    const hash=treeHash({treeId,qualificationId:balls[i],owner:company.companyPrincipalId,effectiveAt:at.toISOString(),kind:'COMPANY_BOOTSTRAP'});
    await tx.qualificationOwnerInterval.create({data:{qualificationId:balls[i],ownerType:'COMPANY',companyPrincipalId:company.companyPrincipalId,effectiveFrom:at,sourceType:'TREE_BOOTSTRAP',sourceId:treeId,evidenceHash:hash}});
    const evidenceId=randomUUID();
    await tx.placementTreeEvidence.create({data:{placementTreeEvidenceId:evidenceId,binaryTreeId:treeId,qualificationId:balls[i],parentQualificationId:i?balls[0]:null,side:i===1?'LEFT':i===2?'RIGHT':null,binaryPositionNo,
     placementKind:i?'BOOTSTRAP':'BOOTSTRAP_ROOT',sourceType:'TREE_BOOTSTRAP',actorType:'ADMIN',actorId,reason,effectiveAt:at,topologyVersion:1,correlationId,evidenceHash:hash}});
    await tx.binaryTreeMembership.create({data:{qualificationId:balls[i],binaryTreeId:treeId,binaryPositionNo,effectiveFrom:at,placementTreeEvidenceId:evidenceId}});
    await tx.qualification.update({where:{qualificationId:balls[i]},data:{ballNo}});
    await tx.binaryTreeAncestry.create({data:{binaryTreeId:treeId,ancestorQualificationId:balls[i],descendantQualificationId:balls[i],depth:0,effectiveFrom:at}});
    if(i)await tx.binaryTreeAncestry.create({data:{binaryTreeId:treeId,ancestorQualificationId:balls[0],descendantQualificationId:balls[i],depth:1,firstSide:i===1?'LEFT':'RIGHT',effectiveFrom:at}});
   }
   for(let positionNo=1;positionNo<=7;positionNo++)await tx.treeCanonicalPosition.create({data:{binaryTreeId:treeId,positionNo,parentPositionNo:positionNo===1?null:Math.floor(positionNo/2),
    side:positionNo===1?null:positionNo%2===0?'LEFT':'RIGHT',occupantQualificationId:positionNo<=3?balls[positionNo-1]:null,occupiedAt:positionNo<=3?at:null}});
   // The approved Company profile is an immutable, effective Core snapshot.  Bind it
   // inside the bootstrap transaction only after the canonical positions and owner
   // intervals exist, so a missing or ambiguous registry rolls the whole tree back.
   const parameters=await effectiveCompanyParameters(tx,at);
   for(const ball of balls)await bindCompanyLeaderProfile(tx,ball,parameters);
   await tx.companySponsorDesignation.create({data:{binaryTreeId:treeId,qualificationId:balls[0],effectiveAt:at,evidenceHash:treeHash({treeId,qualificationId:balls[0],effectiveAt:at.toISOString()})}});
   for(let i=1;i<3;i++){
    await tx.sponsorRelationship.create({data:{sponsorQualificationId:balls[0],childQualificationId:balls[i],sponsorSequenceNo:i,effectiveFrom:at}});
    await tx.binaryPlacement.create({data:{parentQualificationId:balls[0],childQualificationId:balls[i],side:i===1?'LEFT':'RIGHT',effectiveFrom:at}});
   }
   const evidenceHash=treeHash({treeId,treeCode,balls,positions:7,version:1});
   await tx.binaryTreeStatusEvent.create({data:{binaryTreeId:treeId,status:'DRAFT',topologyVersion:1,treeName:tree.treeName,actorId,reason,effectiveAt:at,correlationId,evidenceHash}});
   await tx.binaryTreeProjectionCheckpoint.create({data:{binaryTreeId:treeId,sourceVersion:1,generation:randomUUID(),status:'READY',dataThrough:at}});
   await this.audit(tx,actorId,treeId,'BINARY_TREE_CREATED',{treeCode,balls,topologyVersion:1,evidenceHash},correlationId);
   return {binaryTreeId:treeId,treeCode,treeName:tree.treeName,status:'DRAFT',topologyVersion:1,companyQualificationIds:balls,companyBallNos:[ballNoFor(treeCode,1n),ballNoFor(treeCode,2n),ballNoFor(treeCode,3n)],positions:7,economicActivation:'APPROVED_LEADER_BINDING',effectiveAt:at.toISOString(),evidenceHash};
  });
 }
 async change(p:TreePrincipal,treeId:string,input:{status?:'ACTIVE'|'CLOSED_TO_NEW'|'ARCHIVED';treeName?:string;expectedVersion:number;reason:string;effectiveAt?:string},key:string){
  return this.command(p,'change:'+treeId,key,input,async(tx,actorId)=>{
   const reason=this.reason(input.reason),at=this.effective(input.effectiveAt);await tx.$queryRaw`SELECT binary_tree_id FROM organization.binary_tree WHERE binary_tree_id=${treeId}::uuid FOR UPDATE`;
   const tree=await tx.binaryTree.findUnique({where:{binaryTreeId:treeId}});if(!tree)throw new ConflictException({code:'TREE_NOT_FOUND'});
   if(tree.topologyVersion!==input.expectedVersion)throw new ConflictException({code:'TREE_VERSION_CONFLICT'});
   if(tree.status==='ARCHIVED')throw new ConflictException({code:'TREE_ARCHIVED'});
   const status=input.status??tree.status,allowed={DRAFT:['ACTIVE','ARCHIVED'],ACTIVE:['CLOSED_TO_NEW'],CLOSED_TO_NEW:['ACTIVE','ARCHIVED'],ARCHIVED:[]} as const;
   if(status!==tree.status&&!(allowed[tree.status] as readonly string[]).includes(status))throw new ConflictException({code:'TREE_TRANSITION_INVALID'});
   const name=input.treeName?.trim()??tree.treeName;if(!name||name.length>120)throw new UnprocessableEntityException({code:'TREE_NAME_INVALID'});
   if(status==='ARCHIVED'){
    // Outstanding non-final settlements/payables/replays cannot disappear behind archive.
    const members=await tx.binaryTreeMembership.findMany({where:{binaryTreeId:treeId},select:{qualificationId:true}}),ids=members.map(m=>m.qualificationId);
    if(await tx.payableEntry.findFirst({where:{qualificationId:{in:ids},status:{notIn:['PAID','VOIDED']}}})
     ||await tx.settlementRecalculationRequest.findFirst({where:{impactedQualificationId:{in:ids},status:{not:'PROCESSED'}}}))throw new ConflictException({code:'TREE_UNRESOLVED_OBLIGATIONS'});
    if(tree.status==='DRAFT'&&members.length!==3)throw new ConflictException({code:'TREE_DRAFT_NOT_UNUSED'});
   }
   const version=tree.topologyVersion+1,evidenceHash=treeHash({treeId,previousStatus:tree.status,status,treeName:name,version,effectiveAt:at.toISOString()}),correlationId=randomUUID();
   await tx.binaryTree.update({where:{binaryTreeId:treeId},data:{status,treeName:name,topologyVersion:version}});
   await tx.binaryTreeStatusEvent.create({data:{binaryTreeId:treeId,previousStatus:tree.status,status,treeName:name,topologyVersion:version,actorId,reason,effectiveAt:at,correlationId,evidenceHash}});
   await tx.binaryTreeProjectionCheckpoint.update({where:{binaryTreeId:treeId},data:{sourceVersion:version,dataThrough:at,recordedAt:new Date()}});
   await this.audit(tx,actorId,treeId,'BINARY_TREE_CHANGED',{status,treeName:name,topologyVersion:version,evidenceHash},correlationId);
   return {binaryTreeId:treeId,status,treeName:name,topologyVersion:version,effectiveAt:at.toISOString(),evidenceHash};
  });
 }
 async confirmCompanySponsor(p:TreePrincipal,treeId:string,input:{qualificationId:string;reason:string},key:string){
  return this.command(p,'confirm-sponsor:'+treeId,key,input,async(tx,actorId)=>{
   const reason=this.reason(input.reason),designation=await tx.companySponsorDesignation.findUnique({where:{binaryTreeId:treeId}});if(!designation)throw new ConflictException({code:'TREE_NOT_FOUND'});
   const sequence=await this.organization.allocateSponsorSequence(tx,designation.qualificationId);
   await tx.$queryRaw`SELECT binary_tree_id FROM organization.binary_tree WHERE binary_tree_id=${treeId}::uuid FOR UPDATE`;
   const tree=await tx.binaryTree.findUniqueOrThrow({where:{binaryTreeId:treeId}}),q=await tx.qualification.findUnique({where:{qualificationId:input.qualificationId}});
   if(tree.status!=='ACTIVE')throw new ConflictException({code:'TREE_NOT_OPEN_TO_PLACEMENT'});
   if(!q||q.kind!=='MEMBER_ORIGIN'||!q.currentHolderPersonId||await tx.binaryPlacement.findUnique({where:{childQualificationId:q.qualificationId}}))throw new ConflictException({code:'UNPLACED_MEMBER_QUALIFICATION_REQUIRED'});
   if(await tx.sponsorRelationship.findUnique({where:{childQualificationId:q.qualificationId}}))throw new ConflictException({code:'SPONSOR_ALREADY_CONFIRMED'});
   const at=new Date(),edge=await tx.sponsorRelationship.create({data:{sponsorQualificationId:designation.qualificationId,childQualificationId:q.qualificationId,sponsorSequenceNo:sequence,effectiveFrom:at}}),correlationId=randomUUID();
   await this.audit(tx,actorId,treeId,'FOUNDING_COMPANY_SPONSOR_CONFIRMED',{qualificationId:q.qualificationId,sponsorRelationshipId:edge.sponsorRelationshipId,actualSponsorSequenceNo:sequence,reason,topologyVersion:tree.topologyVersion},correlationId);
   return {qualificationId:q.qualificationId,sponsorQualificationId:designation.qualificationId,actualSponsorSequenceNo:sequence,sponsorRelationshipId:edge.sponsorRelationshipId};
  });
 }
 async place(p:TreePrincipal,treeId:string,input:{qualificationId:string;binaryParentQualificationId:string;side:'LEFT'|'RIGHT';expectedVersion:number;reason:string;effectiveAt?:string;preflightToken?:string},key:string){
  return this.command(p,'place:'+treeId,key,input,async(tx,actorId)=>{
   const reason=this.reason(input.reason),at=this.effective(input.effectiveAt);await tx.$queryRaw`SELECT binary_tree_id FROM organization.binary_tree WHERE binary_tree_id=${treeId}::uuid FOR UPDATE`;
   const tree=await tx.binaryTree.findUnique({where:{binaryTreeId:treeId}});if(!tree||tree.topologyVersion!==input.expectedVersion)throw new ConflictException({code:'TREE_VERSION_CONFLICT'});
   const parent=await tx.binaryTreeMembership.findUnique({where:{qualificationId:input.binaryParentQualificationId}});if(parent?.binaryTreeId!==treeId)throw new ConflictException({code:'BINARY_TREE_SCOPE_MISMATCH'});
   const sponsor=await tx.sponsorRelationship.findUnique({where:{childQualificationId:input.qualificationId}});if(!sponsor)throw new ConflictException({code:'SPONSOR_CONFIRMATION_MISSING'});
   await this.organization.assertBinarySlotAvailable(tx,input.binaryParentQualificationId,input.side);await this.organization.assertNoBinaryCycle(tx,input.qualificationId,input.binaryParentQualificationId);
   await this.organization.assertFirstThirdLeftRule(tx,sponsor.sponsorQualificationId,sponsor.sponsorSequenceNo,input.binaryParentQualificationId,input.side);
   if(input.preflightToken){
    const target=await tx.qualification.findUniqueOrThrow({where:{qualificationId:input.qualificationId}});
    const expected=treeHash({treeId,version:tree.topologyVersion,qualificationId:target.qualificationId,holder:target.currentHolderPersonId,parent:input.binaryParentQualificationId,side:input.side,sponsorId:sponsor.sponsorRelationshipId,sequence:sponsor.sponsorSequenceNo});
    if(input.preflightToken!==expected)throw new ConflictException({code:'PLACEMENT_PREFLIGHT_STALE'});
   }
   const setup=await tx.qualificationSetup.findUnique({where:{qualificationId:input.qualificationId}});
   if(setup && (!['PLACEMENT_PENDING','PLACEMENT_OVERDUE'].includes(setup.setupStatus)||setup.finalSponsorQualificationId!==sponsor.sponsorQualificationId))throw new ConflictException({code:'PLACEMENT_NOT_PENDING'});
   const edge=await this.organization.createBinaryPlacement(tx,{parentQualificationId:input.binaryParentQualificationId,childQualificationId:input.qualificationId,side:input.side,effectiveFrom:at},{sourceType:'TREE_PLACEMENT_CONSOLE',actorId,reason,correlationId:randomUUID()});
   if(setup){
    const correlationId=randomUUID(),evidenceBody={qualificationId:input.qualificationId,sponsorQualificationId:sponsor.sponsorQualificationId,binaryParentQualificationId:input.binaryParentQualificationId,side:input.side,placedByType:'ADMIN_OVERRIDE',placedByPersonId:actorId,placedAt:at.toISOString(),reasonCode:reason,policyVersion:setup.setupPolicyVersion,previousStatus:setup.setupStatus};
    const evidence=await tx.placementEvidence.create({data:{...evidenceBody,placedAt:at,correlationId,evidenceHash:treeHash(evidenceBody)}});
    await tx.qualificationSetup.update({where:{qualificationId:input.qualificationId},data:{setupStatus:'PLACED',placedAt:at}});
    await tx.qualification.update({where:{qualificationId:input.qualificationId},data:{status:'EFFECTIVE',effectiveAt:at}});
    await tx.qualificationStatusHistory.create({data:{qualificationId:input.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'QUALIFICATION_PLACEMENT',sourceId:evidence.placementEvidenceId}});
    await tx.auditEvent.create({data:{actorType:'USER',actorId,action:'QUALIFICATION_PLACED',entityType:'Qualification',entityId:input.qualificationId,afterData:evidenceBody,requestId:correlationId,correlationId}});
    await tx.outboxEvent.create({data:{eventType:'QUALIFICATION_PLACED',aggregateType:'Qualification',aggregateId:input.qualificationId,payload:{schemaVersion:1,...evidenceBody,evidenceHash:evidence.evidenceHash},correlationId}});
   }
   const placed=await tx.qualification.findUniqueOrThrow({where:{qualificationId:input.qualificationId}}),parentBall=await tx.qualification.findUniqueOrThrow({where:{qualificationId:input.binaryParentQualificationId}}),membership=await tx.binaryTreeMembership.findUniqueOrThrow({where:{qualificationId:input.qualificationId}});
   return {binaryTreeId:treeId,treeCode:tree.treeCode,ballNo:placed.ballNo,parentBallNo:parentBall.ballNo,binaryPositionNo:membership.binaryPositionNo.toString(),path:binaryPath(membership.binaryPositionNo),binaryPlacementId:edge.binaryPlacementId,topologyVersion:tree.topologyVersion+1,effectiveAt:at.toISOString()};
  });
 }
 async preview(p:TreePrincipal,treeId:string,input:{qualificationId:string;binaryParentQualificationId:string;side:'LEFT'|'RIGHT';expectedVersion:number}){
  await this.authorize(p);
  const result=await this.db.$transaction(async tx=>{
   const tree=await tx.binaryTree.findUnique({where:{binaryTreeId:treeId}}),target=await tx.qualification.findUnique({where:{qualificationId:input.qualificationId}}),parent=await tx.binaryTreeMembership.findUnique({where:{qualificationId:input.binaryParentQualificationId}});
   if(!tree||tree.topologyVersion!==input.expectedVersion)throw new ConflictException({code:'TREE_VERSION_CONFLICT'});
   if(tree.status!=='ACTIVE')throw new ConflictException({code:'TREE_NOT_OPEN_TO_PLACEMENT'});
   if(parent?.binaryTreeId!==treeId)throw new ConflictException({code:'BINARY_TREE_SCOPE_MISMATCH'});
   if(!target||target.kind!=='MEMBER_ORIGIN'||!target.currentHolderPersonId||!target.planLevelCode)throw new ConflictException({code:'MEMBER_OWNER_EVIDENCE_REQUIRED'});
   if(await tx.binaryPlacement.findUnique({where:{childQualificationId:target.qualificationId}})||await tx.binaryTreeMembership.findUnique({where:{qualificationId:target.qualificationId}}))throw new ConflictException({code:'QUALIFICATION_ALREADY_PLACED'});
   const sponsor=await tx.sponsorRelationship.findUnique({where:{childQualificationId:target.qualificationId}}),now=new Date();
   if(!sponsor||sponsor.effectiveFrom>now||(sponsor.effectiveTo&&sponsor.effectiveTo<=now))throw new ConflictException({code:'SPONSOR_CONFIRMATION_MISSING'});
   const setup=await tx.qualificationSetup.findUnique({where:{qualificationId:target.qualificationId}});
   if(setup&&(!['PLACEMENT_PENDING','PLACEMENT_OVERDUE'].includes(setup.setupStatus)||setup.finalSponsorQualificationId!==sponsor.sponsorQualificationId))throw new ConflictException({code:'PLACEMENT_NOT_PENDING'});
   await this.organization.assertBinarySlotAvailable(tx,input.binaryParentQualificationId,input.side);await this.organization.assertNoBinaryCycle(tx,target.qualificationId,input.binaryParentQualificationId);
   await this.organization.assertFirstThirdLeftRule(tx,sponsor.sponsorQualificationId,sponsor.sponsorSequenceNo,input.binaryParentQualificationId,input.side);
   const positions=await tx.treeCanonicalPosition.findMany({where:{binaryTreeId:treeId}}),parentPosition=positions.find(s=>s.occupantQualificationId===input.binaryParentQualificationId);
   const canonical=parentPosition&&positions.find(s=>s.parentPositionNo===parentPosition.positionNo&&s.side===input.side);
   if(canonical){const designation=await tx.companySponsorDesignation.findUniqueOrThrow({where:{binaryTreeId:treeId}});if(sponsor.sponsorQualificationId!==designation.qualificationId)throw new ConflictException({code:'FOUNDING_COMPANY_SPONSOR_REQUIRED'});}
   const proposedPosition=childPosition(parent.binaryPositionNo,input.side);
   return {valid:true,binaryTreeId:treeId,treeCode:tree.treeCode,ballNo:target.ballNo,parentBallNo:(await tx.qualification.findUniqueOrThrow({where:{qualificationId:input.binaryParentQualificationId}})).ballNo,expectedBinaryPositionNo:proposedPosition.toString(),expectedPath:binaryPath(proposedPosition),expectedBallNo:ballNoFor(tree.treeCode,proposedPosition),expectedVersion:tree.topologyVersion,sponsorQualificationId:sponsor.sponsorQualificationId,actualSponsorSequenceNo:sponsor.sponsorSequenceNo,
    preflightToken:treeHash({treeId,version:tree.topologyVersion,qualificationId:target.qualificationId,holder:target.currentHolderPersonId,parent:input.binaryParentQualificationId,side:input.side,sponsorId:sponsor.sponsorRelationshipId,sequence:sponsor.sponsorSequenceNo})};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  await this.authorize(p);return result;
 }
 private async audit(tx:Prisma.TransactionClient,actorId:string,treeId:string,action:string,afterData:Prisma.InputJsonObject,correlationId:string){
  await tx.auditEvent.create({data:{actorType:'USER',actorId,action,entityType:'BinaryTree',entityId:treeId,afterData,requestId:correlationId,correlationId}});
  await tx.outboxEvent.create({data:{eventType:'BINARY_TREE_CHANGED',aggregateType:'BinaryTree',aggregateId:treeId,payload:{schemaVersion:1,binaryTreeId:treeId,action,...afterData},correlationId}});
 }
}
