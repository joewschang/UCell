import {Prisma} from '@ucell/database';
import {ServiceUnavailableException} from '@nestjs/common';
import {DAY,monthKey,PersonFact,ratio} from './analytics.policy';
type Person={personId:string;createdAt:Date;status:string;membershipState:string|null};
const LIMIT=100_000;
/** Use recorded identity links only. Never match browsers by IP, name or fingerprint. */
export async function captureProspectFacts(tx:Prisma.TransactionClient,persons:Person[],at:Date):Promise<PersonFact[]>{
 const events=await tx.personMembershipStateEvent.findMany({where:{occurredAt:{lte:at},toState:{in:['NETWORK_MEMBER','FORMAL_MEMBER']}},orderBy:{occurredAt:'asc'},take:LIMIT+1,select:{personId:true,toState:true,occurredAt:true}});
 const applications=await tx.formalMemberApplication.findMany({where:{status:'APPROVED',reviewedAt:{lte:at}},take:LIMIT+1,select:{personId:true,reviewedAt:true}});
 const touches=await tx.referralAttribution.findMany({where:{createdAt:{lte:at}},take:LIMIT+1,select:{referralAttributionId:true,createdAt:true,firstTouchAt:true,personId:true}});
 if([events,applications,touches].some(rows=>rows.length>LIMIT))throw new ServiceUnavailableException('ANALYTICS_PROSPECT_SOURCE_LIMIT');
 const formal=new Map<string,string>(),network=new Map<string,string>();
 const earliest=(map:Map<string,string>,id:string,value:string)=>{if(!map.has(id)||value<map.get(id)!)map.set(id,value);};
 for(const e of events)earliest(e.toState==='FORMAL_MEMBER'?formal:network,e.personId,e.occurredAt.toISOString());
 for(const a of applications)if(a.reviewedAt)earliest(formal,a.personId,a.reviewedAt.toISOString());
 const facts=new Map(persons.map(p=>{const formalAt=formal.get(p.personId)??null,registeredAt=network.get(p.personId)??(['NETWORK_MEMBER','FORMAL_PENDING'].includes(p.membershipState??'')?p.createdAt.toISOString():null);return [p.personId,{id:p.personId,joinedAt:formalAt??p.createdAt.toISOString(),closed:p.status==='CLOSED',registered:p.membershipState!==null,formalAt,prospectAt:registeredAt,prospectSource:registeredAt?'DIRECT' as const:null,anonymous:false,aliases:[],excludeFromLifecycle:p.membershipState==='FORMAL_MEMBER'&&!formalAt} satisfies PersonFact] as [string,PersonFact];}));
 for(const t of touches){
  const id='visitor:'+t.referralAttributionId,first=new Date(Math.min(t.createdAt?.getTime()??t.firstTouchAt.getTime(),t.firstTouchAt.getTime())).toISOString(),person=t.personId?facts.get(t.personId):undefined;
  // A bound browser belongs to its known identity, even if that identity is excluded.
  if(t.personId){if(!person)continue;person.aliases!.push(id);if(person.formalAt&&first>person.formalAt)continue;
   if(!person.prospectAt||first<=person.prospectAt){person.prospectAt=first;person.prospectSource='SHARE';}
  }else facts.set(id,{id,joinedAt:first,closed:false,registered:true,formalAt:null,prospectAt:first,prospectSource:'SHARE',anonymous:true,aliases:[]});
 }
 return [...facts.values()];
}

/** Acquisition cohort conversion, not N stock / P stock. A former P may now be A/S/L. */
export function prospectConversion(persons:PersonFact[],asOf:string,days=30){
 const end=Date.parse(asOf),start=end-days*DAY;
 const eligible=persons.filter(p=>p.prospectAt&&Date.parse(p.prospectAt)<=end&&(!p.formalAt||p.prospectAt<=p.formalAt));
 const cohort=eligible.filter(p=>Date.parse(p.prospectAt!)>=start);
 const converted=(p:PersonFact)=>!!p.formalAt&&Date.parse(p.formalAt)<=end;
 const within30=(p:PersonFact)=>converted(p)&&Date.parse(p.formalAt!)<=Date.parse(p.prospectAt!)+30*DAY;
 const matured=eligible.filter(p=>Date.parse(p.prospectAt!)+30*DAY<=end&&Date.parse(p.prospectAt!)+30*DAY>=start);
 const summarize=(rows:PersonFact[])=>({prospects:rows.length,converted:rows.filter(converted).length,conversionRate:ratio(rows.filter(converted).length,rows.length),anonymous:rows.filter(p=>p.anonymous).length});
 const monthGroups=new Map<string,PersonFact[]>();for(const p of eligible){const month=monthKey(p.prospectAt!);const group=monthGroups.get(month)??[];group.push(p);monthGroups.set(month,group);}
 return {asOf,since:new Date(start).toISOString(),days,...summarize(cohort),
  matured30:{prospects:matured.length,converted:matured.filter(within30).length,conversionRate:ratio(matured.filter(within30).length,matured.length)},
  sources:['SHARE','DIRECT'].map(source=>({source,...summarize(cohort.filter(p=>p.prospectSource===source))})),
  cohorts:[...monthGroups].sort(([a],[b])=>b.localeCompare(a)).slice(0,12).map(([month,rows])=>({month,...summarize(rows)})),
  current:{anonymous:persons.filter(p=>p.anonymous&&!p.formalAt).length,identified:persons.filter(p=>!p.anonymous&&p.formalAt===null&&!p.excludeFromLifecycle).length},
  missingAcquisitionEvidence:persons.filter(p=>p.formalAt&&!p.prospectAt).length,
  basis:'FIRST_OBSERVED_PROSPECT_COHORT_FORMAL_APPROVAL',identityBasis:'BOUND_PERSON_ELSE_BROWSER',
 };
}
