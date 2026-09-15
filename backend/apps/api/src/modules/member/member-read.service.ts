import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService, captureParameters, snapshotValue, pending, verifyReplayEnvelope } from '@ucell/database';
import { QualificationAccessService } from '../auth/qualification-access.service';
import { MemberService } from './member.service';
@Injectable()
export class MemberReadService {
 constructor(private readonly db:PrismaService,private readonly identity:MemberService,private readonly access:QualificationAccessService){}
 async read(personId:string,id:string,kind:string,period?:string){
  await this.identity.context(personId,id);
  return this.db.$transaction(async tx=>{
   await new QualificationAccessService(tx as any).assertHolder(personId,id);
   const now=new Date(),snapshot=await captureParameters(tx,now,'R1.0B'),timezone=snapshotValue(snapshot,'accounting.timezone');
   if(typeof timezone!=='string')pending('HISTORICAL_SNAPSHOT_MISSING','Versioned accounting timezone evidence required');
   const current=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit'}).format(now);
   const month=period??current;
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new UnprocessableEntityException({code:'INVALID_PERIOD'});
   const [bounds]=await tx.$queryRaw<Array<{start:Date;end:Date}>>`SELECT (${month+'-01'}::date::timestamp AT TIME ZONE ${timezone}) AS start, ((${month+'-01'}::date+interval '1 month')::timestamp AT TIME ZONE ${timezone}) AS end`;
   const at={gte:bounds.start,lt:bounds.end};
   const volumes=async()=>{
    const totals:Record<string,number|null>={};
    for(const pvType of ['PV','RPV','EPV'] as const){
     const events=await tx.pvLedger.findMany({where:{qualificationId:id,pvType,occurredAt:at,reversalOfEventId:null}});
     if(!events.length){totals[pvType.toLowerCase()]=null;continue;}
     if(pvType!=='PV')for(const event of events){
      const sourceId=pvType==='RPV'?event.sourceLineId:event.eventId;
      if(!sourceId)pending('HISTORICAL_SNAPSHOT_MISSING','Original event evidence required');
      const row=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:pvType,sourceId}}});
      const evidence=verifyReplayEnvelope(row);
      if(snapshotValue(evidence.parameters,'accounting.timezone')!==timezone)pending('HISTORICAL_SNAPSHOT_MISSING','Historical month timezone does not match query configuration');
     }
     const originalIds=events.map(event=>event.eventId);
     const sum=await tx.pvLedger.aggregate({where:{qualificationId:id,pvType,OR:[{eventId:{in:originalIds}},{reversalOfEventId:{in:originalIds}}]},_sum:{amount:true}});
     totals[pvType.toLowerCase()]=sum._sum.amount?.toNumber()??null;
    }
    return totals;
   };
   if(kind==='sponsor'||kind==='referrals'){
    const links=await tx.sponsorRelationship.findMany({where:{sponsorQualificationId:id,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},include:{child:{include:{currentHolder:true}}},orderBy:{sponsorSequenceNo:'asc'},take:100});
    const parent=await tx.sponsorRelationship.findFirst({where:{childQualificationId:id,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},include:{sponsor:{include:{currentHolder:true}}}});
    const view=(q:any)=>({code:String(q.qualificationNo),name:(q.currentHolder.preferredName??q.currentHolder.legalName).slice(0,1)+'＊'});
    return {qualificationId:id,sponsor:parent?view(parent.sponsor):null,referrals:links.map(row=>view(row.child)),pagination:{limit:100,truncated:links.length===100}};
   }
   if(kind==='binary'){
    const counts=await tx.$queryRaw<Array<{side:string;count:string}>>`WITH RECURSIVE tree AS (SELECT child_qualification_id AS id,side FROM organization.binary_placement WHERE parent_qualification_id=${id}::uuid AND effective_from<=${now} AND (effective_to IS NULL OR effective_to>${now}) UNION ALL SELECT p.child_qualification_id,t.side FROM organization.binary_placement p JOIN tree t ON p.parent_qualification_id=t.id WHERE p.effective_from<=${now} AND (p.effective_to IS NULL OR p.effective_to>${now})) SELECT side::text,COUNT(*)::text AS count FROM tree GROUP BY side`;
    return {qualificationId:id,left:{count:Number(counts.find(row=>row.side==='LEFT')?.count??0),volume:null},right:{count:Number(counts.find(row=>row.side==='RIGHT')?.count??0),volume:null},volumeStatus:'PENDING',volumeReason:'SETTLEMENT_NOT_FINALIZED'};
   }
   if(kind==='repurchase'){
    const rows=await tx.monthlyRecognitionSchedule.findMany({where:{subscription:{qualificationId:id},recognitionMonth:new Date(month+'-01')},orderBy:{installmentNo:'asc'}});
    return {qualificationId:id,period:month,status:rows.some(row=>row.status==='RECOGNIZED')?'ACTIVE':rows.some(row=>['SCHEDULED','DUE'].includes(row.status))?'PENDING':'INACTIVE',recognitions:rows.map(row=>({id:row.recognitionId,status:row.status,dueAt:row.dueAt}))};
   }
   if(kind==='bonuses'||kind==='ledger'){
    const awards=await tx.bonusAward.findMany({where:{recipientQualificationId:id,occurredAt:at},include:{settlementBatch:true,lifecycleEvents:{orderBy:[{occurredAt:'desc'},{createdAt:'desc'},{lifecycleEventId:'desc'}],take:1}},orderBy:[{occurredAt:'asc'},{bonusAwardId:'asc'}],take:100});
    const disclosed=(row:typeof awards[number])=>!!row.lifecycleEvents.length&&row.lifecycleEvents[0].status!=='CALCULATED'&&(!row.settlementBatchId||row.settlementBatch?.status==='FINALIZED');
    if(kind==='bonuses')return {qualificationId:id,period:month,awards:awards.length?awards.map(row=>({id:row.bonusAwardId,name:row.awardType,status:!disclosed(row)?'PENDING':row.lifecycleEvents[0]?.status==='PENDING_45D'?'PENDING45D':row.lifecycleEvents[0].status,amount:disclosed(row)?row.payableAmount.toNumber():null,ruleVersion:row.ruleVersionCode,parameterSnapshotHash:row.parameterSnapshotHash})):[{id:'settlement-pending',name:'獎金結算',status:'PENDING',amount:null}],pagination:{limit:100,truncated:awards.length===100}};
    const recoveries=await tx.bonusRecoveryEvent.findMany({where:{bonusAward:{recipientQualificationId:id},occurredAt:at},orderBy:[{occurredAt:'asc'},{bonusRecoveryEventId:'asc'}],take:100});
    return {qualificationId:id,period:month,entries:[...awards.filter(disclosed).map(row=>({id:row.bonusAwardId,label:row.awardType,amount:row.payableAmount.toNumber(),postedAt:row.createdAt.toISOString(),sourceId:row.sourceEventId??row.bonusAwardId})),...recoveries.map(row=>({id:row.bonusRecoveryEventId,label:'CLAWBACK',amount:row.recoveryAmount.negated().toNumber(),postedAt:row.occurredAt.toISOString(),sourceId:row.bonusAwardId}))],pagination:{limit:100,truncated:awards.length===100||recoveries.length===100}};
   }
   if(kind==='performance'){
    return {qualificationId:id,period:month,...await volumes(),left:null,right:null,asOf:now.toISOString(),timezone,parameterSnapshotHash:snapshot.hash,view:'EFFECTIVE_ORIGINAL_EVENT_MONTH',settlementStatus:'PENDING'};
   }
   if(kind==='dashboard'){
    const qualification=(await this.identity.qualifications(personId)).find(row=>row.id===id)!;
    const person=await this.identity.me(personId);
    return {qualificationId:id,qualification,memberName:person.name,memberNo:person.memberNo,monthlyRepurchaseStatus:'PENDING',...await volumes(),bonusAmount:null,bonusStatus:'PENDING',status:'PENDING',reason:'SETTLEMENT_NOT_FINALIZED',view:'EFFECTIVE_ORIGINAL_EVENT_MONTH'};
   }
   if(kind==='orders'){
    const rows=await tx.order.findMany({where:{qualificationId:id},orderBy:[{createdAt:'desc'},{orderId:'desc'}],take:100});
    return {qualificationId:id,orders:rows.map(row=>({id:row.orderId,createdAt:row.createdAt.toISOString(),total:row.netAmount.toNumber(),status:row.status,paymentStatus:row.paidAt?'PAID':'PENDING',shipmentStatus:'FULFILLMENT_PENDING'})),pagination:{limit:100,truncated:rows.length===100}};
   }
   throw new NotFoundException();
  },{isolationLevel:'RepeatableRead'});
 }
 async products(){const rows=await this.db.productReference.findMany({where:{isActive:true},orderBy:{sku:'asc'},take:100});return rows.map(row=>({id:row.productId,name:row.displayName,price:row.currentPrice.toNumber(),pv:null,available:false,reason:'ERP_INVENTORY_PENDING'}));}
 async order(personId:string,id:string,orderId:string){await this.identity.context(personId,id);const order=await this.db.order.findFirst({where:{orderId,qualificationId:id},include:{lines:true}});if(!order)throw new NotFoundException({code:'ORDER_NOT_FOUND'});return {qualificationId:id,id:order.orderId,status:order.status,total:order.netAmount.toString(),createdAt:order.createdAt,lines:order.lines.map(line=>({productId:line.productId,name:line.productNameSnapshot,quantity:line.quantity.toString(),amount:line.lineAmount.toString()}))};}
}
