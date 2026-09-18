import {Prisma} from '@ucell/database';
import {AsOfContext} from '@ucell/shared';
import {projectionHash} from '../analytics/period-projection.service';
/** A bounded probe selects the interactive path; no full-tree recursive work occurs here. */
export async function treeStatisticsProjection(tx:Prisma.TransactionClient,id:string,time:AsOfContext){
 const query={metrics:['founding.statistics'],time,dimensions:['binaryTreeId'],groupBy:['binaryTreeId'],filters:{binaryTreeId:id},limit:100};
 const hash=projectionHash(query);
 const [head]=await tx.$queryRaw<any[]>`SELECT h.status,g.generation_id,g.projected_at,g.data_through,g.source_hash,g.manifest
 FROM integration.period_aggregate_head h LEFT JOIN integration.period_aggregate_generation g USING(generation_id) WHERE h.query_hash=${hash}`;
 const [probe]=await tx.$queryRaw<Array<{n:bigint}>>`SELECT count(*) n FROM (SELECT 1 FROM organization.binary_tree_membership
 WHERE binary_tree_id=${id}::uuid AND effective_from<=${new Date(time.asOf)} AND recorded_at<=${new Date(time.knowledgeCutoff)} LIMIT 10001) bounded`;
 let required=probe.n>10000n;
 // A small tree can still contain millions of PV events. Select the same bounded background path.
 if(!required){const [volumes]=await tx.$queryRaw<Array<{n:bigint}>>`SELECT count(*) n FROM (
  SELECT 1 FROM organization.binary_tree_membership m JOIN ledger.pv_ledger e ON e.qualification_id=m.qualification_id
  WHERE m.binary_tree_id=${id}::uuid AND e.pv_type='GPV' AND e.event_type='GPV_CREATED'
   AND m.effective_from<=e.occurred_at AND m.recorded_at<=${new Date(time.knowledgeCutoff)}
   AND e.occurred_at<${new Date(time.asOf)} AND e.recorded_at<=${new Date(time.knowledgeCutoff)} LIMIT 2001) bounded`;
  required=volumes.n>2000n;}

 const rows=head?.status==='CURRENT'?await tx.$queryRaw<any[]>`SELECT row_key,measures,evidence FROM integration.period_aggregate_row WHERE generation_id=${head.generation_id}::uuid ORDER BY row_key`:[];
 if(head?.status==='CURRENT'&&(rows.length!==4||rows.some((r,i)=>r.row_key!==String(i+4))))throw Error('FOUNDING_PROJECTION_INCOMPLETE');
 return {required,query,projectionStatus:head?.status??(required?'STALE':'NOT_REQUIRED'),snapshot:head?.generation_id??null,projectedAt:head?.projected_at?.toISOString()??null,dataThrough:head?.data_through?.toISOString()??null,sourceHash:head?.source_hash??null,rows};
}
