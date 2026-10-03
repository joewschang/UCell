import {Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {AsOfContext,parseAsOfContext} from '@ucell/shared';
import {authorizeTreePrincipal,TreePrincipal} from '../binary-tree/tree-authorization';
import {treeAncestryCompleteness} from '../binary-tree/tree-ancestry-integrity';
import {readBallsActiveEvidence} from '../binary-tree/tree-active-evidence';
import {readFoundingCarry,readFoundingPerformance} from '../binary-tree/binary-tree-metrics';
import {aggregateGeo,GeoBallFact} from './geo-aggregation';
import {GEO_AREA_VERSION,GEO_DEFINITION_VERSION,GEO_METRICS} from './geo-normalization';

export type GeoQuery={rootQualificationId?:string;rootBallNo?:string;side?:'ALL'|'LEFT'|'RIGHT';level?:'CITY'|'DISTRICT';parentAreaCode?:string;metric?:typeof GEO_METRICS[number];dateFrom:string;dateTo:string;asOf:string;knowledgeCutoff:string;limit?:number;interval?:'DAY'|'WEEK'|'MONTH'};
const viewRoles=['SUPER_ADMIN','ORG_GEO_VIEW','ORG_GEO_DRILLDOWN','ORG_GEO_EXPORT'];
const BOUND=500;
@Injectable()
export class OrganizationGeoService {
 constructor(private readonly db:PrismaService){}
 private time(input:GeoQuery):AsOfContext{
  try{
   const time=parseAsOfContext({timezone:'Asia/Taipei',asOf:input.asOf,knowledgeCutoff:input.knowledgeCutoff,periodStart:input.dateFrom,periodEnd:input.dateTo});
   const now=new Date().toISOString();if(time.asOf>now||time.knowledgeCutoff>now)throw new Error();return time;
  }catch{throw new UnprocessableEntityException({code:'INVALID_GEO_TIME_CONTEXT'});}
 }
 async capture(p:TreePrincipal,input:GeoQuery,exporting=false){
  const roles=exporting?['SUPER_ADMIN','ORG_GEO_EXPORT']:input.level==='DISTRICT'||input.parentAreaCode?['SUPER_ADMIN','ORG_GEO_DRILLDOWN','ORG_GEO_EXPORT']:viewRoles;
  await authorizeTreePrincipal(this.db,p,roles);
  const time=this.time(input),at=new Date(time.asOf),known=new Date(time.knowledgeCutoff);
  const data=await this.db.$transaction(async tx=>{
   if(!input.rootQualificationId&&!input.rootBallNo)throw new UnprocessableEntityException({code:'GEO_ROOT_BALL_REQUIRED'});
   const root=await tx.qualification.findUnique({where:input.rootBallNo?{ballNo:input.rootBallNo}:{qualificationId:input.rootQualificationId!},select:{qualificationId:true,ballNo:true}});
   if(!root||input.rootQualificationId&&input.rootQualificationId!==root.qualificationId)throw new NotFoundException({code:'GEO_ROOT_NOT_FOUND'});
   const membership=await tx.binaryTreeMembership.findFirst({where:{qualificationId:root.qualificationId,effectiveFrom:{lte:at},recordedAt:{lte:known}}});
   if(!membership)throw new NotFoundException({code:'GEO_ROOT_NOT_FOUND'});
   const treeId=membership.binaryTreeId;
   const base={rootBallNo:root.ballNo,time,definitionVersion:GEO_DEFINITION_VERSION,areaVersion:GEO_AREA_VERSION,sourceWatermark:time.knowledgeCutoff,geographyBasis:'APPROVED_COMMUNICATION_ADDRESS_AT_CHECKPOINT',gpvUnit:'GPV_POINT'};
   const unavailable=(reason:string)=>({...base,status:'UNAVAILABLE' as const,reason,summary:null,distribution:[],branchComparison:[],carry:null,lastUpdated:null});
   if(await treeAncestryCompleteness(tx,treeId,time)!=='0')return unavailable('CANONICAL_ANCESTRY_EVIDENCE_INCOMPLETE');
   const descendants=await tx.binaryTreeAncestry.findMany({where:{binaryTreeId:treeId,ancestorQualificationId:root.qualificationId,depth:{gt:0},effectiveFrom:{lte:at},recordedAt:{lte:known}},take:BOUND+1,orderBy:{descendantQualificationId:'asc'}});
   if(descendants.length>BOUND)return unavailable('GEO_SCALE_PROJECTION_REQUIRED');
   const ids=descendants.map(d=>d.descendantQualificationId);
   const members=await tx.binaryTreeMembership.findMany({where:{binaryTreeId:treeId,qualificationId:{in:ids},effectiveFrom:{lte:at},recordedAt:{lte:known}}});
   const owners=await tx.qualificationOwnerInterval.findMany({where:{qualificationId:{in:ids},effectiveFrom:{lte:at},recordedAt:{lte:known},OR:[{effectiveTo:null},{effectiveTo:{gt:at}},{closedRecordedAt:{gt:known}}]}});
   const profiles=await tx.memberGeoProfileVersion.findMany({where:{memberId:{in:owners.flatMap(o=>o.ownerType==='MEMBER'&&o.personId?[o.personId]:[])},sourceEffectiveAt:{lte:at},sourceRecordedAt:{lte:known}},orderBy:[{sourceEffectiveAt:'desc'},{sourceRecordedAt:'desc'},{geoProfileVersionId:'asc'}],take:10001});
   if(profiles.length>10000)return unavailable('GEO_ADDRESS_PROJECTION_LIMIT');
   const activeEvidence=await readBallsActiveEvidence(tx,owners.filter(o=>o.ownerType==='MEMBER').map(o=>o.qualificationId),time);
   const facts:GeoBallFact[]=[];
   for(const descendant of descendants){
    const ownerRows=owners.filter(o=>o.qualificationId===descendant.descendantQualificationId),memberRows=members.filter(m=>m.qualificationId===descendant.descendantQualificationId);
    if(ownerRows.length!==1||memberRows.length!==1||!['LEFT','RIGHT'].includes(descendant.firstSide??''))return unavailable('GEO_HISTORICAL_OWNER_OR_PLACEMENT_MISSING');
    const owner=ownerRows[0],personId=owner.ownerType==='MEMBER'?owner.personId:null;
    if(owner.ownerType==='MEMBER'&&!personId)return unavailable('GEO_MEMBER_OWNER_PERSON_MISSING');
    const profile=personId?profiles.find(g=>g.memberId===personId):undefined;
    if(profile&&profiles.filter(g=>g.memberId===personId&&g.sourceEffectiveAt.getTime()===profile.sourceEffectiveAt.getTime()&&g.sourceRecordedAt.getTime()===profile.sourceRecordedAt.getTime()).length>1)return unavailable('GEO_AMBIGUOUS_ADDRESS_HISTORY');
    const active=owner.ownerType==='MEMBER'?activeEvidence.get(descendant.descendantQualificationId)?.state??'UNKNOWN':'UNKNOWN';
    facts.push({qualificationId:descendant.descendantQualificationId,personId,ownerType:owner.ownerType,firstSide:descendant.firstSide as 'LEFT'|'RIGHT',placedAt:memberRows[0].effectiveFrom.toISOString(),active,cityCode:profile?.cityCode??null,districtCode:profile?.districtCode??null});
   }
   const performance=await readFoundingPerformance(tx,treeId,root.qualificationId,time,true);
   const aggregate=aggregateGeo(facts,performance.status==='AVAILABLE'?performance.sourceFacts??[]:[],{side:input.side??'ALL',level:input.level??'CITY',parentAreaCode:input.parentAreaCode,periodStart:time.periodStart,periodEnd:time.periodEnd,gpvAvailable:performance.status==='AVAILABLE'});
   const carry=await readFoundingCarry(tx,root.qualificationId,time);
   return {...base,...aggregate,status:performance.status==='AVAILABLE'&&aggregate.summary.unknownActiveBalls===0?'AVAILABLE':'PARTIAL',reason:performance.reason??(aggregate.summary.unknownActiveBalls?'GEO_ACTIVE_EVIDENCE_INCOMPLETE':null),carry,lastUpdated:performance.status==='AVAILABLE'?performance.lastUpdated:null,gpvSourceHash:performance.status==='AVAILABLE'?performance.sourceHash:null};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
  await authorizeTreePrincipal(this.db,p,roles);return data;
 }
 async topMarkets(p:TreePrincipal,input:GeoQuery){
  const result=await this.capture(p,input),metric=input.metric??'BALLS';
  if(metric==='GPV'&&result.summary?.gpv==null)return {...result,distribution:[],reason:'GEO_GPV_RANKING_UNAVAILABLE'};
  const key={BALLS:'balls',MEMBERS:'members',ACTIVE_BALLS:'activeBalls',NEW_BALLS:'newBalls',GPV:'gpv'}[metric] as 'balls'|'members'|'activeBalls'|'newBalls'|'gpv';
  const rows=result.distribution.filter(r=>r.areaCode!=='UNLOCATED');
  rows.sort((a,b)=>new Prisma.Decimal(b[key]??0).cmp(new Prisma.Decimal(a[key]??0))||a.areaCode.localeCompare(b.areaCode));
  return {...result,distribution:rows.slice(0,Math.min(input.limit??10,20))};
 }
 async trend(p:TreePrincipal,input:GeoQuery){
  const roles=input.level==='DISTRICT'||input.parentAreaCode?['SUPER_ADMIN','ORG_GEO_DRILLDOWN','ORG_GEO_EXPORT']:viewRoles;
  await authorizeTreePrincipal(this.db,p,roles);const time=this.time(input);
  if(!input.rootQualificationId&&!input.rootBallNo)throw new UnprocessableEntityException({code:'GEO_ROOT_BALL_REQUIRED'});
  const root=await this.db.qualification.findUnique({where:input.rootBallNo?{ballNo:input.rootBallNo}:{qualificationId:input.rootQualificationId!},select:{qualificationId:true}});
  if(!root||input.rootQualificationId&&root.qualificationId!==input.rootQualificationId)throw new NotFoundException({code:'GEO_ROOT_NOT_FOUND'});
  const membership=await this.db.binaryTreeMembership.findFirst({where:{qualificationId:root.qualificationId,effectiveFrom:{lte:new Date(time.asOf)},recordedAt:{lte:new Date(time.knowledgeCutoff)}},orderBy:{effectiveFrom:'asc'},select:{effectiveFrom:true}});
  if(!membership)throw new NotFoundException({code:'GEO_ROOT_NOT_FOUND'});
  const buckets:Array<{start:string;end:string}>=[];
  let start=new Date(Math.max(Date.parse(time.periodStart),membership.effectiveFrom.getTime()));const actualPeriodStart=start.toISOString();
  const until=Math.min(Date.parse(time.periodEnd),Date.parse(time.asOf));
  while(start.getTime()<until){
   let next:Date;
   if(input.interval==='MONTH'){
    const taipei=new Date(start.getTime()+8*3600000);
    next=new Date(Date.UTC(taipei.getUTCFullYear(),taipei.getUTCMonth()+1,1)-8*3600000);
   }else next=new Date(start.getTime()+(input.interval==='WEEK'?7:1)*86400000);
   const end=new Date(Math.min(next.getTime(),until));
   buckets.push({start:start.toISOString(),end:end.toISOString()});start=end;
   if(buckets.length>31)throw new UnprocessableEntityException({code:'GEO_TREND_MAX_31_BUCKETS_SELECT_COARSER_INTERVAL'});
  }
  const rows=[];
  for(const bucket of buckets){
   const snapshot=await this.capture(p,{...input,dateFrom:bucket.start,dateTo:bucket.end,asOf:bucket.end});
   rows.push({periodStart:bucket.start,periodEnd:bucket.end,status:snapshot.status,reason:snapshot.reason,summary:snapshot.summary});
  }
  await authorizeTreePrincipal(this.db,p,roles);
  return {definitionVersion:GEO_DEFINITION_VERSION,sourceWatermark:time.knowledgeCutoff,time,actualPeriodStart,interval:input.interval??'DAY',rows};
 }
}
