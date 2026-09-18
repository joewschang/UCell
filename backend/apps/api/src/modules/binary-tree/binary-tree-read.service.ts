import {readBallActiveEvidence} from './tree-active-evidence';
import {treeAncestryCompleteness} from './tree-ancestry-integrity';
import {treeStatisticsProjection} from './tree-statistics-projection';
import {readTreeNodeSnapshot} from './tree-node-snapshot';
import {readFoundingPerformance,readFoundingCarry} from './binary-tree-metrics';
import {Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {AsOfContext,parseAsOfContext} from '@ucell/shared';
import {BinaryTreeService,TreePrincipal} from './binary-tree.service';
@Injectable()
export class BinaryTreeReadService {
 constructor(private readonly db:PrismaService,private readonly commands:BinaryTreeService){}
 private time(raw:unknown){try{const time=parseAsOfContext(raw),now=new Date().toISOString();if(time.asOf>now||time.knowledgeCutoff>now)throw new Error();return time;}catch{throw new UnprocessableEntityException({code:'INVALID_AS_OF_CONTEXT'});}}
 async list(p:TreePrincipal,raw:unknown,after?:string){
  const time=this.time(raw);await this.commands.authorize(p);
  const data=await this.db.$transaction(async tx=>{
   const trees=await tx.binaryTree.findMany({where:{effectiveAt:{lte:new Date(time.asOf)},createdAt:{lte:new Date(time.knowledgeCutoff)},...(after?{binaryTreeId:{gt:after}}:{})},orderBy:{binaryTreeId:'asc'},take:51});
   const items=[];
   for(const tree of trees.slice(0,50)){
    const event=await tx.binaryTreeStatusEvent.findFirst({where:{binaryTreeId:tree.binaryTreeId,effectiveAt:{lte:new Date(time.asOf)},recordedAt:{lte:new Date(time.knowledgeCutoff)}},orderBy:{topologyVersion:'desc'}});
    if(event)items.push({binaryTreeId:tree.binaryTreeId,treeCode:tree.treeCode,treeName:event.treeName,status:event.status,statusVersion:event.topologyVersion,economicActivation:'APPROVED_LEADER_BINDING'});
   }
   return {items,nextCursor:trees.length>50?trees[49].binaryTreeId:null,time};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  await this.commands.authorize(p);return data;
 }
 async detail(p:TreePrincipal,id:string,raw:unknown){
  const time=this.time(raw);await this.commands.authorize(p);
  const data=await this.db.$transaction(async tx=>this.snapshot(tx,id,time),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
  await this.commands.authorize(p);return data;
 }
 async nodes(p:TreePrincipal,id:string,raw:unknown,after?:string,snapshotToken?:string,parentQualificationId?:string){
 const time=this.time(raw);await this.commands.authorize(p);const result=await readTreeNodeSnapshot(this.db,p,id,time,after,snapshotToken,parentQualificationId);await this.commands.authorize(p);return result;
 }
 private async snapshot(tx:Prisma.TransactionClient,id:string,time:AsOfContext){
  const at=new Date(time.asOf),known=new Date(time.knowledgeCutoff);
  const tree=await tx.binaryTree.findFirst({where:{binaryTreeId:id,effectiveAt:{lte:at},createdAt:{lte:known}}});
  const status=await tx.binaryTreeStatusEvent.findFirst({where:{binaryTreeId:id,effectiveAt:{lte:at},recordedAt:{lte:known}},orderBy:{topologyVersion:'desc'}});
  if(!tree||!status)return {status:'UNAVAILABLE',explainCode:'HISTORICAL_UNAVAILABLE',time,result:null};
  const evidence=await tx.placementTreeEvidence.findMany({where:{binaryTreeId:id,effectiveAt:{lte:at},recordedAt:{lte:known}},orderBy:{topologyVersion:'desc'},take:1});
  const version=Math.max(status.topologyVersion,evidence[0]?.topologyVersion??0);
  const slots=await tx.treeCanonicalPosition.findMany({where:{binaryTreeId:id},orderBy:{positionNo:'asc'}});
  const statistics=await treeStatisticsProjection(tx,id,time);
  if(!statistics.required&&await treeAncestryCompleteness(tx,id,time)!=='0')return {status:'UNAVAILABLE',explainCode:'CANONICAL_ANCESTRY_EVIDENCE_INCOMPLETE',time,result:null};
  const positions=[];const numberOrNull=(value:unknown)=>value==null?null:Number(value);
  for(const slot of slots){
   const membership=slot.occupantQualificationId?await tx.binaryTreeMembership.findFirst({where:{qualificationId:slot.occupantQualificationId,binaryTreeId:id,effectiveFrom:{lte:at},recordedAt:{lte:known}}}):null;
   if(!membership){positions.push({positionNo:slot.positionNo,parentPositionNo:slot.parentPositionNo,side:slot.side,qualificationId:null,ownerType:null,activeLabel:null,descendantBalls:null,distinctMemberPersons:null,newBallsInPeriod:null,leftDescendantBalls:null,rightDescendantBalls:null,leftNewBallsInPeriod:null,rightNewBallsInPeriod:null,performance:null,carry:null});continue;}
   const owners=await tx.qualificationOwnerInterval.findMany({where:{qualificationId:membership.qualificationId,effectiveFrom:{lte:at},recordedAt:{lte:known},OR:[{effectiveTo:null},{effectiveTo:{gt:at}},{closedRecordedAt:{gt:known}}]},take:2});
   if(owners.length!==1)return {status:'UNAVAILABLE',explainCode:'OWNER_EVIDENCE_UNAVAILABLE',time,result:null};
   const owner=owners[0];
   const activeEvidence=owner.ownerType==='COMPANY'?{state:'ALWAYS_ACTIVE',lastUpdated:owner.recordedAt}:await readBallActiveEvidence(tx,membership.qualificationId,time);
   const active=activeEvidence.state;
   const projected=statistics.rows.find(r=>r.row_key===String(slot.positionNo));
   const m=projected?.measures;
   const counts=projected?[{balls:m.descendantBalls,persons:null,new_balls:m.monthlyNewBalls,left_balls:m.leftBalls,right_balls:m.rightBalls,left_new:m.leftMonthlyNewBalls,right_new:m.rightMonthlyNewBalls}]:statistics.required?[{balls:null,persons:null,new_balls:null,left_balls:null,right_balls:null,left_new:null,right_new:null}]:await tx.$queryRaw<Array<{balls:bigint;persons:bigint;new_balls:bigint;left_balls:bigint;right_balls:bigint;left_new:bigint;right_new:bigint}>>`
    SELECT max(greatest(a.recorded_at,m.recorded_at,o.recorded_at)) AS updated,count(DISTINCT a.descendant_qualification_id) AS balls,
      count(DISTINCT CASE WHEN a.first_side='LEFT' THEN a.descendant_qualification_id END) AS left_balls,
      count(DISTINCT CASE WHEN a.first_side='RIGHT' THEN a.descendant_qualification_id END) AS right_balls,
      count(DISTINCT CASE WHEN a.first_side='LEFT' AND m.effective_from>=${new Date(time.periodStart)} AND m.effective_from<${new Date(time.periodEnd)} AND m.effective_from<${at} THEN m.qualification_id END) AS left_new,
      count(DISTINCT CASE WHEN a.first_side='RIGHT' AND m.effective_from>=${new Date(time.periodStart)} AND m.effective_from<${new Date(time.periodEnd)} AND m.effective_from<${at} THEN m.qualification_id END) AS right_new,
      count(DISTINCT CASE WHEN o.owner_type='MEMBER' THEN o.person_id END) AS persons,
      count(DISTINCT CASE WHEN m.effective_from>=${new Date(time.periodStart)} AND m.effective_from<${new Date(time.periodEnd)} AND m.effective_from<${at} THEN m.qualification_id END) AS new_balls
    FROM organization.binary_tree_ancestry a
    JOIN organization.binary_tree_membership m ON m.binary_tree_id=a.binary_tree_id AND m.qualification_id=a.descendant_qualification_id
    LEFT JOIN membership.qualification_owner_interval o ON o.qualification_id=m.qualification_id AND o.effective_from<=${at} AND o.recorded_at<=${known}
      AND (o.effective_to IS NULL OR o.effective_to>${at} OR o.closed_recorded_at>${known})
    WHERE a.binary_tree_id=${id}::uuid AND a.ancestor_qualification_id=${membership.qualificationId}::uuid AND a.depth>0
      AND a.effective_from<=${at} AND a.recorded_at<=${known} AND m.effective_from<=${at} AND m.recorded_at<=${known}`;
   const founding=await tx.foundingOccupationEvidence.findFirst({where:{qualificationId:membership.qualificationId,effectiveAt:{lte:at},recordedAt:{lte:known}}});
   const performance=projected?{status:m.cumulativeGpv===null?'UNAVAILABLE':'AVAILABLE',reason:null,value:m.cumulativeGpv===null?null:{cumulative:String(m.cumulativeGpv),month:String(m.monthlyGpv),leftMonth:String(m.leftMonthlyGpv),rightMonth:String(m.rightMonthlyGpv)}}:slot.positionNo>=4?(statistics.required?{status:'UNAVAILABLE',reason:'BACKGROUND_PROJECTION_REQUIRED',value:null}:await readFoundingPerformance(tx,id,membership.qualificationId,time)):null;
   const carry=projected?.evidence.carry??(slot.positionNo>=4?await readFoundingCarry(tx,membership.qualificationId,time):null);
   const lastUpdated=[membership.recordedAt,owner.recordedAt,activeEvidence.lastUpdated,(counts[0] as any).updated,(performance as any)?.lastUpdated,(carry as any)?.lastUpdated,projected?.evidence.lastUpdated].filter(v=>v!=null).map(v=>new Date(v).toISOString()).sort().at(-1)!;
   positions.push({performance,carry,holderId:owner.personId??owner.companyPrincipalId,occupationStatus:'OCCUPIED',lastUpdated,dataThrough:statistics.dataThrough??time.knowledgeCutoff,evidenceQuality:slot.positionNo<4?'AUTHORITATIVE':performance?.status==='AVAILABLE'&&carry?.status==='AVAILABLE'&&active!=='UNKNOWN'?'AUTHORITATIVE':'PARTIAL',leftDescendantBalls:numberOrNull(counts[0].left_balls),rightDescendantBalls:numberOrNull(counts[0].right_balls),leftNewBallsInPeriod:numberOrNull(counts[0].left_new),rightNewBallsInPeriod:numberOrNull(counts[0].right_new),positionNo:slot.positionNo,parentPositionNo:slot.parentPositionNo,side:slot.side,qualificationId:membership.qualificationId,ownerType:owner.ownerType,
    activeLabel:active==='ALWAYS_ACTIVE'?'Always Active (Company Rule)':m?.active??active,actualSponsorSequenceNo:founding?.actualSponsorSequenceNo??(slot.positionNo===2?1:slot.positionNo===3?2:null),
    descendantBalls:numberOrNull(counts[0].balls),distinctMemberPersons:numberOrNull(counts[0].persons),newBallsInPeriod:numberOrNull(counts[0].new_balls)});
  }
  return {status:'PARTIAL',quality:'PARTIAL',finality:'NOT_APPLICABLE',time,scope:{binaryTreeId:id},definitionVersion:'TREE_FOUNDATION_V1',
   result:{binaryTreeId:id,treeCode:tree.treeCode,treeName:status.treeName,status:status.status,topologyVersion:version,economicActivation:'APPROVED_LEADER_BINDING',positions,statistics:{...statistics,rows:undefined},
    monetaryMetrics:null,monetaryExplainCode:'TREE_MONETARY_READ_NOT_AVAILABLE'},
   evidenceRefs:[{type:'BinaryTreeStatusEvent',id:status.binaryTreeStatusEventId,revision:String(status.topologyVersion)},...evidence.map(e=>({type:'PlacementTreeEvidence',id:e.placementTreeEvidenceId,revision:String(e.topologyVersion)}))]};
 }
}
