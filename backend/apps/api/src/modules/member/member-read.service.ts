import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService, captureParameters, snapshotValue, pending, verifyReplayEnvelope } from '@ucell/database';
import { QualificationAccessService } from '../auth/qualification-access.service';
import { MemberService } from './member.service';
export function memberSafeAnonymousNode(q:{ballNo:string|null}){return {code:q.ballNo??'UNAVAILABLE',name:'',nodeKind:'AnonymousBallNode' as const};}
export async function readBinarySettlement(tx:any,qualificationId:string,settlementBatchId:string){
 const batch=await tx.settlementBatch.findUnique({where:{settlementBatchId}});
 if(!batch||batch.settlementType!=='BINARY_K1')throw new NotFoundException({code:'BINARY_SETTLEMENT_NOT_FOUND'});
 if(batch.status!=='FINALIZED'||!batch.finalizedAt||!batch.calculationHash||!/^[a-f0-9]{64}$/.test(batch.calculationHash))pending('SETTLEMENT_NOT_FINALIZED','Finalized Binary settlement evidence is required');
 const snapshotRow=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'BINARY_K1',sourceId:settlementBatchId}}});
 const evidence=verifyReplayEnvelope(snapshotRow);
 if(evidence.kind!=='BINARY_K1'||evidence.sourceId!==settlementBatchId||evidence.ruleVersionCode!==batch.ruleVersionCode)pending('HISTORICAL_SNAPSHOT_MISSING','Binary settlement replay evidence does not match the requested batch');
 if(evidence.inputs?.periodStart!==batch.periodStart.toISOString()||evidence.inputs?.periodEnd!==batch.periodEnd.toISOString())pending('HISTORICAL_SNAPSHOT_MISSING','Binary settlement period evidence does not match the requested batch');
 if(!evidence.parameters?.hash||!/^[a-f0-9]{64}$/.test(evidence.parameters.hash))pending('HISTORICAL_SNAPSHOT_MISSING','Binary settlement Parameter snapshot hash is required');
 const carries=Array.isArray(evidence.evidence?.carryRecipients)?evidence.evidence.carryRecipients.filter((row:any)=>row?.qualificationId===qualificationId):[];
 if(carries.length!==1)pending('HISTORICAL_SNAPSHOT_MISSING','Unique historical Binary carry evidence is required for the selected Qualification');
 const carry=carries[0] as Record<string,unknown>;
 const metric=(name:string)=>{const value=Number(carry[name]);if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)pending('HISTORICAL_SNAPSHOT_MISSING',`Historical Binary ${name} evidence is invalid`);return value;};
 return {qualificationId,left:{count:null,volume:metric('leftPeriodGpv'),carry:metric('leftCarryOut')},right:{count:null,volume:metric('rightPeriodGpv'),carry:metric('rightCarryOut')},settlementMetrics:{status:'AVAILABLE' as const,reason:null},settlementScope:{settlementBatchId,periodStart:batch.periodStart.toISOString(),periodEnd:batch.periodEnd.toISOString(),ruleVersion:batch.ruleVersionCode,parameterSnapshotHash:evidence.parameters.hash,calculationHash:batch.calculationHash,finalizedAt:batch.finalizedAt.toISOString()},fullTree:{status:'UNAVAILABLE' as const,reason:'BINARY_TREE_READ_MODEL_NOT_AVAILABLE'}};
}
export function unavailableBinaryView(qualificationId:string,counts:Array<{side:string;count:string}>){
 return {
  qualificationId,
  left:{count:Number(counts.find(row=>row.side==='LEFT')?.count??0),volume:null,carry:null},
  right:{count:Number(counts.find(row=>row.side==='RIGHT')?.count??0),volume:null,carry:null},
  settlementMetrics:{status:'UNAVAILABLE' as const,reason:'SETTLEMENT_METRICS_READ_MODEL_NOT_AVAILABLE'},
  settlementScope:null,
  fullTree:{status:'UNAVAILABLE' as const,reason:'BINARY_TREE_READ_MODEL_NOT_AVAILABLE'},
 };
}
@Injectable()
export class MemberReadService {
 constructor(private readonly db:PrismaService,private readonly identity:MemberService,private readonly access:QualificationAccessService){}
 async read(personId:string,id:string,kind:string,period?:string,settlementBatchId?:string){
  await this.identity.context(personId,id);
  return this.db.$transaction(async tx=>{
   await new QualificationAccessService(tx as any).assertHolder(personId,id);
   if(kind==='binary'&&settlementBatchId)return readBinarySettlement(tx,id,settlementBatchId);
   const now=new Date(),snapshot=await captureParameters(tx,now,'R1.0B'),timezone=snapshotValue(snapshot,'accounting.timezone');
   if(typeof timezone!=='string')pending('HISTORICAL_SNAPSHOT_MISSING','Versioned accounting timezone evidence required');
   const current=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit'}).format(now);
   const month=period??current;
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new UnprocessableEntityException({code:'INVALID_PERIOD'});
   const [bounds]=await tx.$queryRaw<Array<{start:Date;end:Date}>>`SELECT (${month+'-01'}::date::timestamp AT TIME ZONE ${timezone}) AS start, ((${month+'-01'}::date+interval '1 month')::timestamp AT TIME ZONE ${timezone}) AS end`;
   const at={gte:bounds.start,lt:bounds.end};
   const repurchase=async()=>{
    const rows=await tx.monthlyRecognitionSchedule.findMany({where:{subscription:{qualificationId:id},recognitionMonth:new Date(month+'-01')},orderBy:{installmentNo:'asc'}});
    return {qualificationId:id,period:month,status:rows.some(row=>row.status==='RECOGNIZED')?'ACTIVE':rows.some(row=>['SCHEDULED','DUE'].includes(row.status))?'PENDING':'INACTIVE',recognitions:rows.map(row=>({id:row.recognitionId,status:row.status,dueAt:row.dueAt}))};
   };
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
    const links=await tx.sponsorRelationship.findMany({where:{sponsorQualificationId:id,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},include:{child:{include:{currentHolder:true,binaryTreeMembership:true}}},orderBy:{sponsorSequenceNo:'asc'},take:100});
    const parent=await tx.sponsorRelationship.findFirst({where:{childQualificationId:id,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},include:{sponsor:{include:{currentHolder:true,binaryTreeMembership:true}}}});
    // A Member projection is constructed here, not masked in React. Bootstrap #1-#3
    // never cross this boundary; non-direct nodes omit every holder PII field.
    const hiddenBootstrap=(q:any)=>q.binaryTreeMembership&&q.binaryTreeMembership.binaryPositionNo<=3n;
    const direct=(q:any)=>({code:q.ballNo??'UNAVAILABLE',name:(q.currentHolder?.preferredName??q.currentHolder?.legalName??'').slice(0,1)+'＊',nodeKind:'DirectSponsoredIdentity'});
    // The legacy field stays an empty display label for contract compatibility; it
    // never carries a holder name outside a direct-sponsored relationship.
    const anonymous=memberSafeAnonymousNode;
    const safeChildren=links.map(row=>row.child).filter(q=>!hiddenBootstrap(q)).map(direct);
    // A sponsor is upstream, therefore never a direct-sponsored identity for this viewer.
    const safeParent=parent&&!hiddenBootstrap(parent.sponsor)?anonymous(parent.sponsor):null;
    return {qualificationId:id,sponsor:safeParent,referrals:safeChildren,pagination:{limit:100,truncated:links.length===100}};
   }
   if(kind==='binary'){
    const counts=await tx.$queryRaw<Array<{side:string;count:string}>>`WITH RECURSIVE tree AS (SELECT child_qualification_id AS id,side FROM organization.binary_placement WHERE parent_qualification_id=${id}::uuid AND effective_from<=${now} AND (effective_to IS NULL OR effective_to>${now}) UNION ALL SELECT p.child_qualification_id,t.side FROM organization.binary_placement p JOIN tree t ON p.parent_qualification_id=t.id WHERE p.effective_from<=${now} AND (p.effective_to IS NULL OR p.effective_to>${now})) SELECT side::text,COUNT(*)::text AS count FROM tree GROUP BY side`;
    return unavailableBinaryView(id,counts);
   }
   if(kind==='repurchase'){
    return repurchase();
   }
   if(kind==='bonuses'||kind==='ledger'){
    const awards=await tx.bonusAward.findMany({where:{recipientQualificationId:id,occurredAt:at},include:{settlementBatch:true,lifecycleEvents:{orderBy:[{occurredAt:'desc'},{createdAt:'desc'},{lifecycleEventId:'desc'}]}},orderBy:[{occurredAt:'asc'},{bonusAwardId:'asc'}],take:100});
    const state=(row:typeof awards[number])=>{
     const first=row.lifecycleEvents[0];if(!first)return null;
     const statuses=new Set(row.lifecycleEvents.filter(event=>event.occurredAt.getTime()===first.occurredAt.getTime()&&event.createdAt.getTime()===first.createdAt.getTime()).map(event=>event.status));
     if(statuses.size===1)return first.status;
     // Core emits this confirmed initial transition in one createMany batch.
     // Random UUID order cannot reverse CALCULATED -> PENDING_45D.
     if([...statuses].every(status=>['CALCULATED','PENDING_45D'].includes(status)))return 'PENDING_45D' as const;
     return pending('LIFECYCLE_EVIDENCE_AMBIGUOUS','Conflicting lifecycle timestamps require explicit chronology evidence');
    };
    const disclosed=(row:typeof awards[number])=>!!state(row)&&state(row)!=='CALCULATED'&&(!row.settlementBatchId||row.settlementBatch?.status==='FINALIZED');
    if(kind==='bonuses'){
     const ids=awards.map(row=>row.bonusAwardId);
     const anchors=ids.length?await tx.$queryRaw<Array<{bonusAwardId:string;settlementDate:Date;nominalPayoutDate:Date;adjustedPayoutDate:Date;versionCode:string}>>`SELECT a.bonus_award_id AS "bonusAwardId",a.settlement_date AS "settlementDate",a.nominal_payout_date AS "nominalPayoutDate",a.adjusted_payout_date AS "adjustedPayoutDate",v.version_code AS "versionCode" FROM ledger.award_payout_anchor a JOIN rules.business_calendar_version v ON v.business_calendar_version_id=a.business_calendar_version_id WHERE a.bonus_award_id=ANY(${ids}::uuid[])`:[];
     const byAward=new Map(anchors.map(anchor=>[anchor.bonusAwardId,anchor]));
     const date=(value:Date)=>value.toISOString().slice(0,10);
     return {qualificationId:id,period:month,awards:awards.length?awards.map(row=>{const finalized=row.settlementBatch?.status==='FINALIZED',anchor=byAward.get(row.bonusAwardId),current=state(row);return {id:row.bonusAwardId,name:row.awardType,status:finalized&&current?(current==='PENDING_45D'?'PENDING45D':current):'PENDING',amount:finalized?row.payableAmount.toNumber():null,theoryAmount:row.theoryAmount?.toNumber()??null,finalAmount:finalized?row.payableAmount.toNumber():null,payableAmount:finalized?row.payableAmount.toNumber():null,settlementStatus:finalized?'FINALIZED':'PENDING',pendingReason:finalized?null:row.settlementBatchId?'SETTLEMENT_NOT_FINALIZED':'SETTLEMENT_NOT_ASSIGNED',settlementDate:anchor?date(anchor.settlementDate):null,nominalPayoutDate:anchor?date(anchor.nominalPayoutDate):null,adjustedPayoutDate:anchor?date(anchor.adjustedPayoutDate):null,businessCalendarVersion:anchor?.versionCode??null,ruleVersion:row.ruleVersionCode,parameterSnapshotHash:row.parameterSnapshotHash};}):[{id:'settlement-pending',name:'獎金結算',status:'PENDING',amount:null,theoryAmount:null,finalAmount:null,payableAmount:null,settlementStatus:'PENDING',pendingReason:'SETTLEMENT_NOT_AVAILABLE',settlementDate:null,nominalPayoutDate:null,adjustedPayoutDate:null,businessCalendarVersion:null,ruleVersion:null,parameterSnapshotHash:null}],pagination:{limit:100,truncated:awards.length===100}};
    }
    const recoveries=await tx.bonusRecoveryEvent.findMany({where:{bonusAward:{recipientQualificationId:id},occurredAt:at},orderBy:[{occurredAt:'asc'},{bonusRecoveryEventId:'asc'}],take:100});
    return {qualificationId:id,period:month,entries:[...awards.filter(disclosed).map(row=>({id:row.bonusAwardId,label:row.awardType,amount:row.payableAmount.toNumber(),postedAt:row.createdAt.toISOString(),sourceId:row.sourceEventId??row.bonusAwardId})),...recoveries.map(row=>({id:row.bonusRecoveryEventId,label:'CLAWBACK',amount:row.recoveryAmount.negated().toNumber(),postedAt:row.occurredAt.toISOString(),sourceId:row.bonusAwardId}))],pagination:{limit:100,truncated:awards.length===100||recoveries.length===100}};
   }
   if(kind==='performance'){
    return {qualificationId:id,period:month,...await volumes(),left:null,right:null,asOf:now.toISOString(),timezone,parameterSnapshotHash:snapshot.hash,view:'EFFECTIVE_ORIGINAL_EVENT_MONTH',settlementStatus:'PENDING'};
   }
   if(kind==='dashboard'){
    const qualification=(await this.identity.qualifications(personId)).find(row=>row.id===id)!;
    const person=await this.identity.me(personId);
    const interval=await tx.activeIntervalEvidence.findFirst({where:{qualificationId:id,calendarMonth:new Date(month+'-01')},orderBy:{createdAt:'desc'}});
    const activeInterval=interval?{activeFrom:interval.activeFrom.toISOString(),activeTo:interval.activeTo.toISOString()}:null;
    return {qualificationId:id,qualification:{...qualification,monthReference:month,active:!!interval&&interval.activeFrom<=now&&interval.activeTo>now,activeInterval},memberName:person.name,memberNo:person.memberNo,monthReference:month,activeInterval,monthlyRepurchaseStatus:(await repurchase()).status,...await volumes(),bonusAmount:null,bonusStatus:'PENDING',status:'PENDING',reason:'SETTLEMENT_NOT_FINALIZED',view:'EFFECTIVE_ORIGINAL_EVENT_MONTH'};
   }
   if(kind==='orders'){
    const rows=await tx.order.findMany({where:{qualificationId:id},orderBy:[{createdAt:'desc'},{orderId:'desc'}],take:100});
    return {qualificationId:id,orders:rows.map(row=>({id:row.orderId,createdAt:row.createdAt.toISOString(),total:row.netAmount.toNumber(),status:row.status,paymentStatus:row.paidAt?'PAID':'PENDING',shipmentStatus:'FULFILLMENT_PENDING'})),pagination:{limit:100,truncated:rows.length===100}};
   }
   throw new NotFoundException();
  },{isolationLevel:'RepeatableRead'});
 }
 async products(){const now=new Date();const rows=await this.db.productReference.findMany({where:{isActive:true},include:{ruleProfiles:{where:{effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}}},orderBy:{sku:'asc'},take:100});return rows.map(row=>{const profile=row.ruleProfiles[0],available=row.ruleProfiles.length===1&&profile.ruleVersionCode==='R1.0B'&&!!profile.parameterSnapshotHash&&/^[a-f0-9]{64}$/.test(profile.parameterSnapshotHash);return {id:row.productId,name:row.displayName,price:row.currentPrice.toNumber(),pv:null,available,reason:available?null:'RULE_PROFILE_CONFIGURATION_PENDING',fulfillmentStatus:'ERP_PENDING',availabilityMeaning:'ORDERABLE_NOT_STOCK_CONFIRMATION'};});}
 async order(personId:string,id:string,orderId:string){await this.identity.context(personId,id);const order=await this.db.order.findFirst({where:{orderId,qualificationId:id},include:{lines:true}});if(!order)throw new NotFoundException({code:'ORDER_NOT_FOUND'});return {qualificationId:id,id:order.orderId,status:order.status,total:order.netAmount.toString(),createdAt:order.createdAt,lines:order.lines.map(line=>({productId:line.productId,name:line.productNameSnapshot,quantity:line.quantity.toString(),amount:line.lineAmount.toString()}))};}
}
