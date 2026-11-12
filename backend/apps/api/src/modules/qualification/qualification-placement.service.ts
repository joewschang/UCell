import {ConflictException,ForbiddenException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {PrismaService,Prisma,qualificationReturnReviewPolicy} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {placementMonitor} from './placement-monitor';
import {bundleDescendantsForPlacement} from './enrollment-bundle-placement';
import {placeDeferredQualification,placePlannedDescendants} from './place-deferred-qualification';
import {OrganizationService} from '../organization/organization.service';
import {QualificationAccessService} from '../auth/qualification-access.service';

type PlacementInput={qualificationId:string;binaryParentQualificationId:string;side:'LEFT'|'RIGHT';reasonCode?:string};
type MemberPlacementInput={placementReference:string;binaryParentBallNo:string;side:'LEFT'|'RIGHT'};
const publicBallNo=/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6}|\d{6,19})$/;

@Injectable()
export class QualificationPlacementService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService,private readonly organization:OrganizationService){}

 async pendingForSponsorOwner(personId:string,now=new Date()){
  const owned=await this.db.qualification.findMany({where:{OR:[
   {currentHolderPersonId:personId},
   {currentHolderLegalEntity:{representatives:{some:{personId,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}}}}
  ]},select:{qualificationId:true}}),sponsorIds=owned.map(x=>x.qualificationId);
  if(!sponsorIds.length)return [];
  const planned=await this.db.$queryRaw<{id:string;position:number;count:number}[]>`
   SELECT b.qualification_id AS id,b.position,(SELECT count(*)::int FROM membership.enrollment_bundle_ball c WHERE c.bundle_id=b.bundle_id) AS count
   FROM membership.enrollment_bundle_ball b
   JOIN membership.qualification_setup s ON s.qualification_id=b.qualification_id
   WHERE s.final_sponsor_qualification_id IN (${Prisma.join(sponsorIds.map(id=>Prisma.sql`${id}::uuid`))})
     AND s.setup_status IN ('PLACEMENT_PENDING','PLACEMENT_OVERDUE')`;
  const hidden=planned.filter(b=>b.position>1).map(b=>b.id);
  const groupSizes=new Map(planned.filter(b=>b.position===1).map(b=>[b.id,b.count]));
  const rows=await this.db.qualificationSetup.findMany({where:{setupStatus:{in:['PLACEMENT_PENDING','PLACEMENT_OVERDUE']},qualificationId:{notIn:hidden},finalSponsorQualificationId:{in:sponsorIds}},orderBy:{placementDueAt:'asc'},take:100});
  const personIds=[...new Set(rows.map(x=>x.ownerPersonId).filter((id):id is string=>!!id))],qualificationIds=[...new Set(rows.flatMap(x=>[x.qualificationId,x.finalSponsorQualificationId].filter((id):id is string=>!!id)))]; const [people,qualifications]=await Promise.all([this.db.person.findMany({where:{personId:{in:personIds}},select:{personId:true,memberNo:true}}),this.db.qualification.findMany({where:{qualificationId:{in:qualificationIds}},select:{qualificationId:true,qualificationNo:true,ballNo:true}})]); const memberNoByPerson=new Map(people.map(x=>[x.personId,x.memberNo])),qualificationById=new Map(qualifications.map(x=>[x.qualificationId,x])); return rows.map(x=>{const pending=qualificationById.get(x.qualificationId);return {...this.view(x,now,{memberNo:(x.ownerPersonId?memberNoByPerson.get(x.ownerPersonId):null)??null,pendingBallNo:pending?.ballNo??null,placementReference:pending?`P${pending.qualificationNo}`:null,sponsorBallNo:x.finalSponsorQualificationId?qualificationById.get(x.finalSponsorQualificationId)?.ballNo??null:null}),...(groupSizes.has(x.qualificationId)?{bundleBallCount:groupSizes.get(x.qualificationId)}:{})};});
 }

 async dashboard(input:{status?:string;after?:string;take?:number}){return placementMonitor(this.db,input);}
 async monitor(input:{status?:string;aging?:string;take?:number}={},now=new Date()){
  const take=Math.min(Math.max(Number.isFinite(input.take)?input.take!:50,1),100),rows=await this.db.qualificationSetup.findMany({where:{setupStatus:{in:['PLACEMENT_PENDING','PLACEMENT_OVERDUE','PLACED']}},orderBy:{placementDueAt:'asc'},take:100});
  return rows.map(x=>this.view(x,now)).filter(x=>(!input.status||x.status===input.status)&&(!input.aging||x.agingBucket===input.aging)).slice(0,take);
 }

 async returnReviews(){
  const rows=await this.db.qualificationSetup.findMany({where:{setupStatus:'RETURN_REVIEW_PENDING'},orderBy:{updatedAt:'asc'},take:100});
  return Promise.all(rows.map(async row=>{
   const order=await this.db.order.findUniqueOrThrow({where:{orderId:row.qualifyingOrderId}});
   const returned=await this.db.returnLine.aggregate({where:{returnCase:{orderId:order.orderId,status:'POSTED'}},_sum:{returnAmount:true}});
   const purchase=await this.db.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:order.orderId}});
   const person=row.ownerPersonId?await this.db.person.findUnique({where:{personId:row.ownerPersonId},select:{memberNo:true}}):null;
   return {qualificationId:row.qualificationId,orderId:order.orderId,orderNo:order.orderNo.toString(),memberNo:person?.memberNo??null,originalPackageType:row.packageType,remainingAmount:purchase.priceAmount.sub(returned._sum.returnAmount??0).toString(),status:row.setupStatus};
  }));
 }

 async approveReturnReview(actorId:string|undefined,qualificationId:string,input:{planLevelCode:string;reasonCode:string},key:string,requestId:string){
  const prices:Record<string,string>={STARTER:'14400',ELITE:'43200',LEADER:'72000'};
  if(!actorId||!prices[input.planLevelCode]||!input.reasonCode?.trim())throw new UnprocessableEntityException({code:'QUALIFICATION_RETURN_REVIEW_INPUT_REQUIRED'});
  return this.idempotency.execute(`admin:qualification-return-review:${qualificationId}`,key,input,async tx=>{
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${qualificationId},0))) lock_row`;
   const setup=await tx.qualificationSetup.findUniqueOrThrow({where:{qualificationId}});
   if(setup.setupStatus!=='RETURN_REVIEW_PENDING'||setup.placedAt)throw new ConflictException({code:'QUALIFICATION_RETURN_REVIEW_NOT_PENDING'});
   await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${setup.qualifyingOrderId}::uuid FOR UPDATE`;
   const order=await tx.order.findUniqueOrThrow({where:{orderId:setup.qualifyingOrderId}});
   const returned=await tx.returnLine.aggregate({where:{returnCase:{orderId:order.orderId,status:'POSTED'}},_sum:{returnAmount:true}});
   const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:order.orderId}});
   const remaining=purchase.priceAmount.sub(returned._sum.returnAmount??0);
   if(order.status!=='PARTIAL_RETURN'||remaining.lt(new Prisma.Decimal(prices[input.planLevelCode]).sub(purchase.discountAmount)))throw new UnprocessableEntityException({code:'QUALIFICATION_RETAINED_AMOUNT_INSUFFICIENT'});
   const now=new Date(),correlationId=randomUUID(),status=setup.finalSponsorQualificationId?'PLACEMENT_PENDING':'BALL_SETUP_PENDING';
   await tx.qualification.update({where:{qualificationId},data:{planLevelCode:input.planLevelCode}});
   await tx.qualificationSetup.update({where:{qualificationId},data:{setupStatus:status,placementRequestedAt:setup.finalSponsorQualificationId?now:null,placementDueAt:setup.finalSponsorQualificationId?new Date(now.getTime()+72*3600000):null}});
   await this.audit.write(tx,{actorType:'USER',actorId,action:'QUALIFICATION_RETURN_REVIEW_APPROVED',entityType:'Qualification',entityId:qualificationId,afterData:{...input,orderId:order.orderId,remainingAmount:remaining.toString(),policy:qualificationReturnReviewPolicy},requestId,correlationId});
   return {qualificationId,planLevelCode:input.planLevelCode,status,remainingAmount:remaining.toString()};
  });
 }

 async placeBySponsorOwner(personId:string,input:PlacementInput,key:string,requestId:string){return this.place(personId,'SPONSOR_OWNER',input,key,requestId);}
 async placeBySponsorOwnerReference(personId:string,input:MemberPlacementInput,key:string,requestId:string){
  const match=/^P([1-9]\d{0,18})$/.exec(input.placementReference);if(!match||BigInt(match[1])>9223372036854775807n||!publicBallNo.test(input.binaryParentBallNo))throw new UnprocessableEntityException({code:'PLACEMENT_REFERENCE_INVALID'});
  const [qualification,parent]=await Promise.all([this.db.qualification.findUnique({where:{qualificationNo:BigInt(match[1])},select:{qualificationId:true,ballNo:true}}),this.db.qualification.findUnique({where:{ballNo:input.binaryParentBallNo},select:{qualificationId:true,ballNo:true}})]);
  if(!qualification||!parent)throw new NotFoundException({code:'PLACEMENT_BALL_NOT_FOUND'});
  const placed=await this.place(personId,'SPONSOR_OWNER',{qualificationId:qualification.qualificationId,binaryParentQualificationId:parent.qualificationId,side:input.side},key,requestId);
  const placedQualification=await this.db.qualification.findUniqueOrThrow({where:{qualificationId:qualification.qualificationId},select:{ballNo:true}});
  return {ballNo:placedQualification.ballNo,binaryParentBallNo:parent.ballNo,side:placed.value.side,placedAt:placed.value.placedAt,evidenceHash:placed.value.evidenceHash};
 }
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
   if(placedByType==='SPONSOR_OWNER'){
    const setup=await tx.qualificationSetup.findUnique({where:{qualificationId:input.qualificationId}});
    if(!actorPersonId||!setup?.finalSponsorQualificationId)throw new ForbiddenException({code:'PLACEMENT_AUTHORITY_DENIED'});
    try{await new QualificationAccessService(tx as any).assertHolder(actorPersonId,setup.finalSponsorQualificationId);}catch{throw new ForbiddenException({code:'PLACEMENT_AUTHORITY_DENIED'});}
   }
   const descendants=await bundleDescendantsForPlacement(tx,input.qualificationId);
   const receipt=await placeDeferredQualification(tx,this.organization,this.audit,actorPersonId,placedByType,input,requestId,descendants!==null);
   await placePlannedDescendants(tx,this.organization,this.audit,descendants,requestId);
   return receipt;
  },{timeout:120000});}catch(error){if(['P2002','P2034'].includes((error as any).code)||((error as any).code==='P2010'&&(error as any).meta?.code==='40001'))throw new ConflictException({code:'PLACEMENT_CONFLICT'});throw error;}
 }

 private view(row:any,now:Date,identity?:{memberNo:string|null;pendingBallNo:string|null;placementReference:string|null;sponsorBallNo:string|null}){const status=row.setupStatus==='PLACEMENT_PENDING'&&row.placementDueAt&&row.placementDueAt<=now?'PLACEMENT_OVERDUE':row.setupStatus,ageMs=row.placementRequestedAt?Math.max(0,now.getTime()-row.placementRequestedAt.getTime()):0,h=Math.floor(ageMs/3600000),agingBucket=status==='PLACEMENT_OVERDUE'||h>=72?'OVERDUE':h>=48?'48_72H':h>=24?'24_48H':'0_24H';return {pendingBallNo:identity?.pendingBallNo??null,placementReference:identity?.placementReference??null,pendingMemberNo:identity?.memberNo??null,packageType:row.packageType,sponsorBallNo:identity?.sponsorBallNo??null,paymentState:'CONFIRMED',requestedAt:row.placementRequestedAt?.toISOString()??null,dueAt:row.placementDueAt?.toISOString()??null,placedAt:row.placedAt?.toISOString()??null,status,agingBucket,policyVersion:row.setupPolicyVersion};}
}
