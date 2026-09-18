import {Prisma} from '@ucell/database';
import {AnalyticsQuery} from '@ucell/shared';
import type {ProjectedFacts} from './period-projection-sources';
/** Recognized-consideration cohort; GPV is never substituted for TWD. */
export async function projectReturnCohort(tx:Prisma.TransactionClient,q:AnalyticsQuery):Promise<ProjectedFacts>{
 const t=q.time,at=new Date(t.asOf),known=new Date(t.knowledgeCutoff),start=new Date(t.periodStart),end=new Date(t.periodEnd);
 const [lineage]=await tx.$queryRaw<any[]>(Prisma.sql`SELECT count(*)::text missing FROM ledger.consumption_recognition_event r
  LEFT JOIN commerce.order_line l ON l.order_line_id=r.source_line_id AND l.order_id=r.source_id
  LEFT JOIN commerce."order" o ON o.order_id=l.order_id AND o.qualification_id=r.qualification_id
  WHERE r.direction='ORIGINAL' AND r.eligible AND r.eligible_amount>0 AND r.source_type='ORDER'
   AND r.recognized_at>=${start} AND r.recognized_at<${end} AND r.recognized_at<${at} AND r.created_at<=${known}
   AND(l.order_line_id IS NULL OR o.order_id IS NULL)
   ${t.ruleVersion?Prisma.sql`AND r.rule_version_code=${t.ruleVersion}`:Prisma.empty}`);
 const rows=await tx.$queryRaw<any[]>(Prisma.sql`WITH cohort AS (
  SELECT r.consumption_recognition_event_id,r.source_id order_id,r.source_line_id,l.quantity,l.line_amount,r.eligible_amount,
   o.currency,l.product_id,m.binary_tree_id,f.ancestor_qualification_id founding_ball,
   CASE WHEN r.eligible_amount=l.line_amount THEN true ELSE false END complete_allocation,
   coalesce(ret.amount,0) returned_amount,coalesce(ret.quantity,0) returned_quantity,coalesce(ret.orders,false) returned_order
  FROM ledger.consumption_recognition_event r
  JOIN commerce.order_line l ON l.order_line_id=r.source_line_id AND l.order_id=r.source_id
  JOIN commerce."order" o ON o.order_id=l.order_id AND o.qualification_id=r.qualification_id
  LEFT JOIN organization.binary_tree_membership m ON m.qualification_id=r.qualification_id AND m.effective_from<=r.recognized_at AND m.recorded_at<=${known}
  LEFT JOIN LATERAL(SELECT a.ancestor_qualification_id FROM organization.binary_tree_ancestry a
   JOIN organization.tree_canonical_position c ON c.binary_tree_id=a.binary_tree_id AND c.occupant_qualification_id=a.ancestor_qualification_id AND c.position_no BETWEEN 4 AND 7
   WHERE a.binary_tree_id=m.binary_tree_id AND a.descendant_qualification_id=r.qualification_id AND a.depth>0
    AND a.effective_from<=r.recognized_at AND a.recorded_at<=${known}) f ON true
  LEFT JOIN LATERAL(SELECT sum(rl.return_amount) amount,sum(rl.quantity) quantity,bool_or(rl.return_amount>0) orders
   FROM commerce.return_line rl JOIN commerce.return_case rc ON rc.return_case_id=rl.return_case_id
   WHERE rl.order_line_id=l.order_line_id AND rc.status='POSTED' AND rc.posted_at<=${at} AND rc.posted_at<=${known} AND rc.created_at<=${known} AND rl.created_at<=${known}) ret ON true
  WHERE r.direction='ORIGINAL' AND r.eligible AND r.eligible_amount>0 AND r.source_type='ORDER'
   AND r.recognized_at>=${start} AND r.recognized_at<${end} AND r.recognized_at<${at} AND r.created_at<=${known}
   ${q.filters.binaryTreeId?Prisma.sql`AND m.binary_tree_id=${q.filters.binaryTreeId}::uuid`:Prisma.empty}
   ${q.filters.foundingBallId?Prisma.sql`AND f.ancestor_qualification_id=${q.filters.foundingBallId}::uuid`:Prisma.empty}
   ${q.filters.productId?Prisma.sql`AND l.product_id=${q.filters.productId}::uuid`:Prisma.empty}
   ${q.filters.currency?Prisma.sql`AND o.currency=${q.filters.currency}`:Prisma.empty}
   ${t.ruleVersion?Prisma.sql`AND r.rule_version_code=${t.ruleVersion}`:Prisma.empty}
 ), grouped AS (
  SELECT *,
   CASE WHEN ${q.groupBy.includes('binaryTreeId')} THEN binary_tree_id::text ELSE NULL END tree_group,
   CASE WHEN ${q.groupBy.includes('foundingBallId')} THEN founding_ball::text ELSE NULL END founding_group,
   CASE WHEN ${q.groupBy.includes('productId')} THEN product_id::text ELSE NULL END product_group
  FROM cohort
 ) SELECT currency,tree_group,founding_group,product_group,count(*)::text lines,
  count(DISTINCT order_id)::text denominator_orders,count(DISTINCT order_id) FILTER(WHERE returned_order)::text numerator_orders,
  coalesce(sum(eligible_amount),0)::text denominator_amount,coalesce(sum(returned_amount),0)::text numerator_amount,
  coalesce(sum(quantity),0)::text denominator_units,coalesce(sum(returned_quantity),0)::text numerator_units,
  count(*) FILTER(WHERE NOT complete_allocation)::text missing_allocation,
  count(*) FILTER(WHERE returned_amount>eligible_amount OR returned_quantity>quantity)::text invalid_return
 FROM grouped GROUP BY currency,tree_group,founding_group,product_group ORDER BY currency,tree_group NULLS FIRST,founding_group NULLS FIRST,product_group NULLS FIRST LIMIT 10001`);
 if(!rows.length)rows.push({currency:q.filters.currency??'NO_POPULATION',tree_group:null,founding_group:null,product_group:null,lines:'0',denominator_orders:'0',numerator_orders:'0',denominator_amount:'0',numerator_amount:'0',denominator_units:'0',numerator_units:'0',missing_allocation:'0',invalid_return:'0'});
 const invalid=lineage.missing!=='0'||rows.some(r=>r.invalid_return!=='0'||r.missing_allocation!=='0');
 const ratio=(n:string,d:string)=>new Prisma.Decimal(d).isZero()?null:new Prisma.Decimal(n).div(d).toFixed(8);
 return {status:invalid?'STALE':'CURRENT',manifest:{metric:q.metrics[0],grain:'ORIGINAL_RECOGNIZED_ORDER_LINE_COHORT',currency:'SOURCE_ORDER_CURRENCY_SEPARATE_NO_FX',population:'POSITIVE_ELIGIBLE_ORDER_RECOGNITIONS',numerator:'Linked POSTED returned original eligible lines observed through asOf and knowledgeCutoff',denominator:'Original eligible consideration / distinct orders / recognized full-line units in source period',zeroDenominator:'NULL_NO_POPULATION',unavailableReason:invalid?'RECOGNIZED_ALLOCATION_OR_RETURN_EVIDENCE_INCOMPLETE':null,missingSourceLineage:lineage.missing,foundingIncludesSelf:false,productOrderCountsNonadditive:true},
  rows:rows.map(r=>{
   const dimensions:Record<string,string>={currency:r.currency};if(q.groupBy.includes('binaryTreeId'))dimensions.binaryTreeId=r.tree_group??'UNPLACED';if(q.groupBy.includes('foundingBallId'))dimensions.foundingBallId=r.founding_group??'OUTSIDE_FOUNDING_DESCENDANTS';if(q.groupBy.includes('productId'))dimensions.productId=r.product_group??'NO_POPULATION';
   return {key:Object.values(dimensions).join(':')||'TOTAL',dimensions,measures:{orderNumerator:r.numerator_orders,orderDenominator:r.denominator_orders,orderRate:ratio(r.numerator_orders,r.denominator_orders),
    amountNumerator:r.missing_allocation==='0'?r.numerator_amount:null,amountDenominator:r.denominator_amount,amountRate:r.missing_allocation==='0'?ratio(r.numerator_amount,r.denominator_amount):null,
    unitNumerator:r.missing_allocation==='0'?r.numerator_units:null,unitDenominator:r.missing_allocation==='0'?r.denominator_units:null,unitRate:r.missing_allocation==='0'?ratio(r.numerator_units,r.denominator_units):null},
    evidence:{source:'ConsumptionRecognitionEvent/OrderLine/POSTED ReturnCase+ReturnLine',recognizedLines:r.lines,missingAllocation:r.missing_allocation,invalidReturns:r.invalid_return}};
  })};
}
