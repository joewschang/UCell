import {Prisma} from '@ucell/database';
import {AnalyticsQuery} from '@ucell/shared';
import {readFoundingCarry} from '../binary-tree/binary-tree-metrics';
import type {ProjectedFacts} from './period-projection-sources';
export async function projectCarry(tx:Prisma.TransactionClient,query:AnalyticsQuery):Promise<ProjectedFacts>{
 const id=query.filters.qualificationId,carry=await readFoundingCarry(tx,id,query.time);
 const field=query.metrics[0]==='binary.left_carry'?'left':query.metrics[0]==='binary.right_carry'?'right':'pairedPv';
 const value=carry.status==='AVAILABLE'?carry.value[field]:null;
 return {status:value==null?'STALE':'CURRENT',manifest:{metric:query.metrics[0],grain:'QUALIFICATION_PERIOD',basis:'LATEST_AUTHORITATIVE_CLOSED_CARRY_THROUGH_ASOF',source:'BinaryCarry/HistoricalReplaySnapshot/ReplayCarryProjection',periodSelection:'LATEST_CLOSED_PERIOD_AT_OR_BEFORE_ASOF',unavailableReason:carry.reason},
 rows:[{key:id,dimensions:{qualificationId:id},measures:{value},evidence:{...carry}}]};
}
export async function projectTreeComparison(tx:Prisma.TransactionClient,query:AnalyticsQuery):Promise<ProjectedFacts>{
 const t=query.time,at=new Date(t.asOf),known=new Date(t.knowledgeCutoff),start=new Date(t.periodStart),end=new Date(t.periodEnd),tree=query.filters.binaryTreeId;
 const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT d.binary_tree_id::text id,count(m.qualification_id)::text balls,
  count(m.qualification_id) FILTER(WHERE m.effective_from>=${start} AND m.effective_from<${end})::text new_balls,
  count(m.qualification_id) FILTER(WHERE e.placement_tree_evidence_id IS NULL)::text missing_evidence,max(m.recorded_at) updated
  FROM organization.company_sponsor_designation d
  LEFT JOIN organization.binary_tree_membership m ON m.binary_tree_id=d.binary_tree_id AND m.effective_from<=${at} AND m.recorded_at<=${known}
  LEFT JOIN organization.placement_tree_evidence e ON e.placement_tree_evidence_id=m.placement_tree_evidence_id AND e.effective_at=m.effective_from AND e.recorded_at<=${known}
  WHERE d.effective_at<=${at} AND d.recorded_at<=${known}
  ${tree?Prisma.sql`AND d.binary_tree_id=${tree}::uuid`:Prisma.empty}
  GROUP BY d.binary_tree_id ORDER BY d.binary_tree_id LIMIT 10001`);
 return {status:rows.some(r=>r.missing_evidence!=='0')?'STALE':'CURRENT',manifest:{metric:'tree.comparison',grain:'TREE_PERIOD',comparisonBasis:'SAME_PERIOD_ASOF_KNOWLEDGE_AND_DATABASE_SNAPSHOT',newBallDefinition:'FIRST_EFFECTIVE_BINARY_PLACEMENT',source:'BinaryTreeMembership/PlacementTreeEvidence',financialMetrics:'SEPARATE_AUTHORITATIVE_METRIC_QUERIES'},
 rows:rows.map(r=>({key:r.id,dimensions:{binaryTreeId:r.id},measures:{balls:r.balls,monthlyNewBalls:r.new_balls},evidence:{missingPlacementEvidence:r.missing_evidence,lastUpdated:r.updated?.toISOString()??null}}))};
}
