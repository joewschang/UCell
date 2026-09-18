import {readBallActiveEvidence} from '../binary-tree/tree-active-evidence';
import {treeAncestryCompleteness} from '../binary-tree/tree-ancestry-integrity';
import {Prisma} from '@ucell/database';
import {AnalyticsQuery} from '@ucell/shared';
import {readFoundingCarry} from '../binary-tree/binary-tree-metrics';
import type {ProjectedFacts,ProjectionRow} from './period-projection-sources';
/** Immutable placement/membership plus signed source GPV; never runs a bonus calculator. */
export async function projectFoundingFacts(tx:Prisma.TransactionClient,q:AnalyticsQuery):Promise<ProjectedFacts>{
 const t=q.time,id=q.filters.binaryTreeId,at=new Date(t.asOf),known=new Date(t.knowledgeCutoff),start=new Date(t.periodStart),end=new Date(t.periodEnd);
 const invalidAncestry=await treeAncestryCompleteness(tx,id,t);
 if(invalidAncestry!=='0')return {status:'STALE',manifest:{metric:q.metrics[0],unavailableReason:'CANONICAL_ANCESTRY_EVIDENCE_INCOMPLETE',invalidMemberships:invalidAncestry},rows:[]};
 const roots=await tx.treeCanonicalPosition.findMany({where:{binaryTreeId:id,positionNo:{gte:4,lte:7}},orderBy:{positionNo:'asc'}});
 if(roots.length!==4)throw Error('FOUNDING_POSITIONS_UNAVAILABLE');
 const scopedRoots=q.filters.foundingBallId?roots.filter(r=>r.occupantQualificationId===q.filters.foundingBallId):roots;
 if(!scopedRoots.length)throw Error('FOUNDING_SCOPE_NOT_IN_TREE');
 const counts=await tx.$queryRaw<any[]>`SELECT a.ancestor_qualification_id::text root,count(*)::text balls,
  count(*) FILTER(WHERE a.first_side='LEFT')::text left_balls,count(*) FILTER(WHERE a.first_side='RIGHT')::text right_balls,
  count(*) FILTER(WHERE m.effective_from>=${start} AND m.effective_from<${end} AND m.effective_from<${at})::text new_balls,
  count(*) FILTER(WHERE a.first_side='LEFT' AND m.effective_from>=${start} AND m.effective_from<${end} AND m.effective_from<${at})::text left_new,
  count(*) FILTER(WHERE a.first_side='RIGHT' AND m.effective_from>=${start} AND m.effective_from<${end} AND m.effective_from<${at})::text right_new,
  max(greatest(a.recorded_at,m.recorded_at)) updated
  FROM organization.binary_tree_ancestry a
  JOIN organization.tree_canonical_position c ON c.binary_tree_id=a.binary_tree_id AND c.occupant_qualification_id=a.ancestor_qualification_id AND c.position_no BETWEEN 4 AND 7
  JOIN organization.binary_tree_membership m ON m.binary_tree_id=a.binary_tree_id AND m.qualification_id=a.descendant_qualification_id
  WHERE a.binary_tree_id=${id}::uuid AND a.depth>0 AND a.effective_from<=${at} AND a.recorded_at<=${known}
   AND m.effective_from<=${at} AND m.recorded_at<=${known}
  GROUP BY a.ancestor_qualification_id`;
 const performance=await tx.$queryRaw<any[]>`WITH source AS(
  SELECT a.ancestor_qualification_id root,a.first_side,e.event_id,e.amount,e.occurred_at,e.recorded_at,
   coalesce(correction.delta,0) delta,coalesce(correction.effects,0) effects,coalesce(correction.invalid,0) invalid,
   coalesce(returns.lines,0) expected_returns,correction.updated correction_updated
  FROM ledger.pv_ledger e JOIN organization.binary_tree_membership m ON m.qualification_id=e.qualification_id
  JOIN organization.binary_tree_ancestry a ON a.binary_tree_id=m.binary_tree_id AND a.descendant_qualification_id=m.qualification_id AND a.depth>0
  JOIN organization.tree_canonical_position c ON c.binary_tree_id=a.binary_tree_id AND c.occupant_qualification_id=a.ancestor_qualification_id AND c.position_no BETWEEN 4 AND 7
  LEFT JOIN LATERAL(SELECT count(*) lines FROM commerce.return_line l JOIN commerce.return_case r ON r.return_case_id=l.return_case_id
   WHERE l.order_line_id=e.source_line_id AND l.gpv_reversal_amount>0 AND r.status='POSTED' AND r.posted_at<=${known} AND l.created_at<=${known}) returns ON true
  LEFT JOIN LATERAL(SELECT sum(v.amount) delta,count(*) effects,max(v.recorded_at) updated,
   count(*) FILTER(WHERE v.event_type<>'GPV_REVERSAL' OR v.source_type<>'RETURN' OR v.qualification_id<>e.qualification_id OR v.rule_version_code<>e.rule_version_code OR v.amount>=0
    OR NOT EXISTS(SELECT 1 FROM commerce.return_line l JOIN commerce.return_case r ON r.return_case_id=l.return_case_id
      WHERE l.return_line_id=v.source_line_id AND r.return_case_id=v.source_id AND l.order_line_id=e.source_line_id AND r.status='POSTED'
       AND r.posted_at<=${known} AND l.gpv_reversal_amount=-v.amount)
    OR (SELECT count(*) FROM audit.audit_event x WHERE x.action='RETURN_REVERSAL_PROCESSED' AND x.entity_id=v.source_id AND x.occurred_at<=${known})<>1) invalid
   FROM ledger.pv_ledger v WHERE v.reversal_of_event_id=e.event_id AND v.recorded_at<=${known}) correction ON true
  WHERE m.binary_tree_id=${id}::uuid AND m.effective_from<=e.occurred_at AND m.recorded_at<=${known}
   AND a.effective_from<=e.occurred_at AND a.recorded_at<=${known}
   AND e.pv_type='GPV' AND e.event_type='GPV_CREATED' AND e.reversal_of_event_id IS NULL
   AND e.occurred_at<${at} AND e.recorded_at<=${known}
 ) SELECT root::text,count(*)::text source_events,coalesce(sum(amount+delta),0)::text cumulative,
  coalesce(sum(amount+delta) FILTER(WHERE occurred_at>=${start} AND occurred_at<${end}),0)::text monthly,
  coalesce(sum(amount+delta) FILTER(WHERE first_side='LEFT' AND occurred_at>=${start} AND occurred_at<${end}),0)::text left_month,
  coalesce(sum(amount+delta) FILTER(WHERE first_side='RIGHT' AND occurred_at>=${start} AND occurred_at<${end}),0)::text right_month,
  count(*) FILTER(WHERE invalid>0 OR effects<>expected_returns OR amount+delta<0)::text invalid_sources,
  max(greatest(recorded_at,correction_updated)) updated FROM source GROUP BY root`;
 const rows:ProjectionRow[]=[];let partial=false,stale=false;
 for(const slot of scopedRoots){
  const member=slot.occupantQualificationId?await tx.binaryTreeMembership.findFirst({where:{qualificationId:slot.occupantQualificationId,effectiveFrom:{lte:at},recordedAt:{lte:known}}}):null;
  if(!member){rows.push({key:String(slot.positionNo),dimensions:{binaryTreeId:id,position:String(slot.positionNo)},measures:{occupation:'AVAILABLE',qualification:null,holder:null,active:null,descendantBalls:null,leftBalls:null,rightBalls:null,monthlyNewBalls:null,leftMonthlyNewBalls:null,rightMonthlyNewBalls:null,cumulativeGpv:null,monthlyGpv:null,leftMonthlyGpv:null,rightMonthlyGpv:null,leftCarry:null,rightCarry:null,pairPv:null},evidence:{quality:'VERIFIED_EMPTY_POSITION',dataThrough:t.knowledgeCutoff}});continue;}
  const root=member.qualificationId,c=counts.find(r=>r.root===root),v=performance.find(r=>r.root===root);
  const owner=await tx.qualificationOwnerInterval.findMany({where:{qualificationId:root,effectiveFrom:{lte:at},recordedAt:{lte:known},OR:[{effectiveTo:null},{effectiveTo:{gt:at}},{closedRecordedAt:{gt:known}}]},take:2});
  if(owner.length!==1)throw Error('FOUNDING_OWNER_EVIDENCE_UNAVAILABLE');
  const activeEvidence=owner[0].ownerType==='COMPANY'?{state:'ALWAYS_ACTIVE',lastUpdated:owner[0].recordedAt}:await readBallActiveEvidence(tx,root,t);
  const active=activeEvidence.state;
  if(active==='UNKNOWN')partial=true;
  const carry=await readFoundingCarry(tx,root,t);
  const bad=v&&v.invalid_sources!=='0';if(bad)stale=true;if(carry.status!=='AVAILABLE')partial=true;
  const last=[member.recordedAt,owner[0].recordedAt,activeEvidence.lastUpdated,c?.updated,v?.updated,carry.status==='AVAILABLE'?carry.lastUpdated:null].filter(Boolean).map(d=>new Date(d).toISOString()).sort().at(-1)!;
  rows.push({key:String(slot.positionNo),dimensions:{binaryTreeId:id,position:String(slot.positionNo),qualificationId:root,foundingBallId:root},
   measures:{occupation:'OCCUPIED',qualification:root,holder:owner[0].personId??owner[0].companyPrincipalId,active,
    descendantBalls:c?.balls??'0',leftBalls:c?.left_balls??'0',rightBalls:c?.right_balls??'0',monthlyNewBalls:c?.new_balls??'0',leftMonthlyNewBalls:c?.left_new??'0',rightMonthlyNewBalls:c?.right_new??'0',
    cumulativeGpv:bad?null:v?.cumulative??'0',monthlyGpv:bad?null:v?.monthly??'0',leftMonthlyGpv:bad?null:v?.left_month??'0',rightMonthlyGpv:bad?null:v?.right_month??'0',
    leftCarry:carry.value?.left??null,rightCarry:carry.value?.right??null,pairPv:carry.status==='AVAILABLE'?carry.value.pairedPv:null},
   evidence:{quality:bad?'UNAVAILABLE':carry.status==='AVAILABLE'&&active!=='UNKNOWN'?'VERIFIED':'PARTIAL',lastUpdated:last,dataThrough:t.knowledgeCutoff,sourceEvents:v?.source_events??'0',invalidSources:v?.invalid_sources??'0',carry}});
 }
 return {status:stale?'STALE':'CURRENT',manifest:{metric:q.metrics[0],grain:'FOUNDING_POSITION_PERIOD',coverage:partial?'PARTIAL':'COMPLETE',population:'BINARY_DESCENDANTS_EXCLUDE_SELF',newBallDefinition:'FIRST_EFFECTIVE_BINARY_PLACEMENT',gpvBasis:'IMMUTABLE_TREE_MEMBERSHIP_AND_SIGNED_PV_LEDGER',correctionPolicy:'LATEST_KNOWN_RESTATED_ORIGINAL_PERIOD',carryBasis:'SEALED_ORIGINAL_OR_REPLAY_CARRY',source:'BinaryTreeAncestry/Membership/PvLedger/POSTED Return+Replay Audit'},rows};
}
