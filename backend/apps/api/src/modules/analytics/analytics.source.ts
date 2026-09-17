import { Prisma } from '@ucell/database';
import { ServiceUnavailableException } from '@nestjs/common';
import { Facts, ActivityFact } from './analytics.policy';

const LIMIT=25_000, EVENT_LIMIT=100_000;
function bounded<T>(rows:T[],limit:number,name:string):T[]{
  if(rows.length>limit)throw new ServiceUnavailableException(`ANALYTICS_SOURCE_LIMIT:${name}; no partial projection published`);
  return rows;
}

/** A bounded, repeatable-read source capture. No money is calculated or written. */
export async function captureAnalyticsFacts(tx:Prisma.TransactionClient,at:Date):Promise<Facts> {
  const persons=bounded(await tx.person.findMany({where:{createdAt:{lte:at}},take:LIMIT+1,orderBy:{personId:'asc'},select:{personId:true,createdAt:true,status:true,membershipState:true}}),LIMIT,'persons');
  const qs=bounded(await tx.qualification.findMany({where:{createdAt:{lte:at}},take:LIMIT+1,orderBy:{qualificationId:'asc'},select:{qualificationId:true,currentHolderPersonId:true,status:true,createdAt:true}}),LIMIT,'qualifications');
  const holders=bounded(await tx.qualificationHolderHistory.findMany({where:{effectiveFrom:{lte:at}},take:EVENT_LIMIT+1,orderBy:{holderHistoryId:'asc'},select:{qualificationId:true,holderPersonId:true,effectiveFrom:true,effectiveTo:true}}),EVENT_LIMIT,'holder_history');
  const paid=bounded(await tx.order.findMany({where:{paidAt:{lte:at}},take:EVENT_LIMIT+1,orderBy:{orderId:'asc'},select:{orderId:true,qualificationId:true,paidAt:true,purpose:true}}),EVENT_LIMIT,'paid_orders');
  const recognized=bounded(await tx.monthlyRecognitionSchedule.findMany({where:{recognizedAt:{lte:at},status:{in:['RECOGNIZED','REVERSED']}},take:EVENT_LIMIT+1,orderBy:{recognitionId:'asc'},select:{recognitionId:true,recognizedAt:true,subscription:{select:{qualificationId:true}}}}),EVENT_LIMIT,'recognitions');
  const periods=bounded(await tx.activePeriod.findMany({where:{activeFrom:{lte:at},OR:[{activeTo:null},{activeTo:{gt:at}}]},take:EVENT_LIMIT+1,orderBy:{activePeriodId:'asc'},select:{qualificationId:true}}),EVENT_LIMIT,'active_periods');
  // Explicitly designated system balls only; no inference from names or arbitrary company people.
  const system=bounded(await tx.systemAssignmentPoolEntry.findMany({where:{enabledFrom:{lte:at}},take:LIMIT+1,orderBy:{systemAssignmentPoolEntryId:'asc'},select:{qualificationId:true,enabledFrom:true,enabledTo:true}}),LIMIT,'system_pool');
  const sponsor=bounded(await tx.sponsorRelationship.findMany({where:{effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},take:LIMIT+1,orderBy:{sponsorRelationshipId:'asc'},select:{sponsorQualificationId:true,childQualificationId:true}}),LIMIT,'sponsor');
  const binary=bounded(await tx.binaryPlacement.findMany({where:{effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},take:LIMIT+1,orderBy:{binaryPlacementId:'asc'},select:{parentQualificationId:true,childQualificationId:true,side:true}}),LIMIT,'binary');
  const personIds=new Set(persons.map(p=>p.personId)),systemIds=new Set(system.filter(q=>!q.enabledTo||q.enabledTo>at).map(q=>q.qualificationId)), activeIds=new Set(periods.map(q=>q.qualificationId));
  const holderMap=new Map<string,typeof holders>();for(const h of holders){const rows=holderMap.get(h.qualificationId)??[];rows.push(h);holderMap.set(h.qualificationId,rows);}
  const activities:ActivityFact[]=[];
  const push=(id:string,qualificationId:string,time:Date,repurchase:boolean)=>{
    if(system.some(s=>s.qualificationId===qualificationId&&s.enabledFrom<=time&&(!s.enabledTo||s.enabledTo>time)))return;
    const candidates=(holderMap.get(qualificationId)??[]).filter(h=>h.effectiveFrom<=time&&(!h.effectiveTo||h.effectiveTo>time));
    // Without event-time ownership, even an apparent zero for NASL can be false. Fail the capture.
    if(candidates.length!==1||!personIds.has(candidates[0].holderPersonId))throw new ServiceUnavailableException('ANALYTICS_EVENT_OWNER_UNAVAILABLE');
    activities.push({id,qualificationId,personId:candidates[0].holderPersonId,at:time.toISOString(),repurchase});
  };
  for(const o of paid)push(`ORDER_PAID:${o.orderId}`,o.qualificationId,o.paidAt!,o.purpose==='REPURCHASE');
  for(const r of recognized)push(`REPURCHASE_RECOGNIZED:${r.recognitionId}`,r.subscription.qualificationId,r.recognizedAt!,true);
  return {persons:persons.map(p=>({id:p.personId,joinedAt:p.createdAt.toISOString(),closed:p.status==='CLOSED',registered:p.membershipState!==null})),
    qualifications:qs.map(q=>({id:q.qualificationId,personId:q.currentHolderPersonId,createdAt:q.createdAt.toISOString(),system:systemIds.has(q.qualificationId),active:q.status==='EFFECTIVE'&&activeIds.has(q.qualificationId)})),
    activities:activities.sort((a,b)=>a.id.localeCompare(b.id)),
    sponsor:sponsor.map(e=>({parent:e.sponsorQualificationId,child:e.childQualificationId})),
    binary:binary.map(e=>({parent:e.parentQualificationId,child:e.childQualificationId,side:e.side})),
    issues:['REGISTRATION_DATE_USES_PERSON_CREATED_AT','SYSTEM_SCOPE_USES_EXPLICIT_POOL','ENGAGEMENT_EVENTS_NOT_CONNECTED','VOLUME_REQUIRES_SEPARATE_ROOT_PROJECTION']};
}
