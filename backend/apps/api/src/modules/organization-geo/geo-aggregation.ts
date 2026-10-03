import {Prisma} from '@ucell/database';
import {GEO_AREAS,GEO_DEFINITION_VERSION} from './geo-normalization';
export type GeoBallFact={qualificationId:string;personId:string|null;ownerType:string;firstSide:'LEFT'|'RIGHT';placedAt:string;active:'ACTIVE'|'INACTIVE'|'UNKNOWN';cityCode:string|null;districtCode:string|null};
export type GeoGpvFact={eventId:string;qualificationId:string;firstSide:string;occurredAt:string;netGpv:string};
export type GeoContext={side:'ALL'|'LEFT'|'RIGHT';level:'CITY'|'DISTRICT';parentAreaCode?:string;periodStart:string;periodEnd:string;gpvAvailable:boolean};
export function aggregateGeo(balls:readonly GeoBallFact[],gpv:readonly GeoGpvFact[],context:GeoContext){
 if(new Set(balls.map(b=>b.qualificationId)).size!==balls.length)throw new Error('GEO_DUPLICATE_BALL_EVIDENCE');
 if(new Set(gpv.map(g=>g.eventId)).size!==gpv.length)throw new Error('GEO_DUPLICATE_GPV_SOURCE');
 const selected=balls.filter(b=>context.side==='ALL'||b.firstSide===context.side);
 const start=Date.parse(context.periodStart),end=Date.parse(context.periodEnd);
 const measure=(rows:readonly GeoBallFact[])=>{
  const ids=new Set(rows.map(b=>b.qualificationId)),eligible=rows.filter(b=>b.ownerType==='MEMBER');
  const unknown=eligible.filter(b=>b.active==='UNKNOWN').length,active=eligible.filter(b=>b.active==='ACTIVE').length;
  const gpvTotal=context.gpvAvailable?gpv.filter(g=>ids.has(g.qualificationId)&&(context.side==='ALL'||g.firstSide===context.side)&&Date.parse(g.occurredAt)>=start&&Date.parse(g.occurredAt)<end).reduce((sum,g)=>sum.add(g.netGpv),new Prisma.Decimal(0)).toFixed(4):null;
  return {balls:rows.length,members:new Set(rows.flatMap(b=>b.ownerType==='MEMBER'&&b.personId?[b.personId]:[])).size,activeBalls:active,activeRate:eligible.length&&!unknown?active/eligible.length:null,newBalls:rows.filter(b=>Date.parse(b.placedAt)>=start&&Date.parse(b.placedAt)<end).length,gpv:gpvTotal,eligibleMemberBalls:eligible.length,unknownActiveBalls:unknown};
 };
 const groups=new Map<string,GeoBallFact[]>();
 for(const ball of selected){
  if(context.parentAreaCode&&ball.cityCode!==context.parentAreaCode)continue;
  const code=(context.level==='CITY'?ball.cityCode:ball.districtCode)??'UNLOCATED';
  const group=groups.get(code)??[];group.push(ball);groups.set(code,group);
 }
 const distribution=[...groups].map(([code,rows])=>({areaCode:code,areaName:code==='UNLOCATED'?'未定位':GEO_AREAS.find(a=>a.code===code)?.name??'未知行政區',status:code==='UNLOCATED'?'UNLOCATED':'AVAILABLE',...measure(rows)})).sort((a,b)=>a.areaCode.localeCompare(b.areaCode));
 const branchComparison=['NORTH','CENTRAL','SOUTH','EAST','ISLAND','UNLOCATED'].map(region=>{
  const rows=selected.filter(b=>(GEO_AREAS.find(a=>a.code===b.cityCode)?.regionGroup??'UNLOCATED')===region);
  return {regionGroup:region,left:measure(rows.filter(b=>b.firstSide==='LEFT')),right:measure(rows.filter(b=>b.firstSide==='RIGHT'))};
 });
 return {definitionVersion:GEO_DEFINITION_VERSION,summary:{...measure(selected),descendantBalls:selected.length,uniqueMembers:measure(selected).members,leftBalls:selected.filter(b=>b.firstSide==='LEFT').length,rightBalls:selected.filter(b=>b.firstSide==='RIGHT').length,unlocatedBalls:selected.filter(b=>!b.cityCode).length,districtUnlocatedBalls:selected.filter(b=>!b.districtCode).length},distribution,branchComparison};
}
