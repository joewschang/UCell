import {financialCompleteness} from './financial-completeness';
import {projectCarry,projectTreeComparison} from './period-carry-source';
import {projectBonusDistribution} from './period-bonus-source';
import {projectFoundingFacts} from './period-founding-source';
import {projectReturnCohort} from './period-return-source';
import {Prisma} from '@ucell/database';
import {AnalyticsQuery} from '@ucell/shared';
import {UnprocessableEntityException} from '@nestjs/common';
export type ProjectionRow={key:string;dimensions:Record<string,string>;measures:Record<string,string|number|null>;evidence:Record<string,unknown>};
export type ProjectedFacts={status:'CURRENT'|'STALE';manifest:Record<string,unknown>;rows:ProjectionRow[]};
const groups:Record<string,string>={'rank.bonus':'BONUS','rank.gpv':'RANK','rank.new_achievements':'RANK','binary.left_carry':'CARRY','binary.right_carry':'CARRY','binary.pairpv':'CARRY','tree.comparison':'TREE','bonus.distribution':'BONUS','founding.statistics':'FOUNDING','return.cohort_rates':'RETURN','rank.distribution':'RANK','active.rate':'ACTIVE','tree.monthly_new_balls':'TREE','reservoir.a':'RESERVOIR','reservoir.b':'RESERVOIR','pool.k0':'K','pool.k1':'K','pool.k2':'K'};
export const SUPPORTED_PERIOD_METRICS=Object.freeze(Object.keys(groups));
export function projectionGroup(query:AnalyticsQuery){
 if(query.time.settlementId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.time.settlementId))throw new UnprocessableEntityException({code:'INVALID_SETTLEMENT_SCOPE'});
 const metric=query.metrics[0],group=groups[metric];if(!group)throw new UnprocessableEntityException({code:'UNSUPPORTED_PROJECTION_METRIC'});
 const treeGroup=['TREE','FOUNDING','RANK','ACTIVE','BONUS'].includes(group);
 const allowed=group==='CARRY'?['qualificationId']:group==='RETURN'?['binaryTreeId','foundingBallId','productId','currency']:group==='FOUNDING'?['binaryTreeId','foundingBallId']:treeGroup?['binaryTreeId']:['settlementId'];
 if(group==='RETURN'&&query.time.settlementId)throw new UnprocessableEntityException({code:'UNSUPPORTED_RETURN_SETTLEMENT_FILTER'});
 if([...query.dimensions,...query.groupBy,...Object.keys(query.filters)].some(k=>!allowed.includes(k)))throw new UnprocessableEntityException({code:'UNSUPPORTED_PROJECTION_DIMENSION'});
 if(Object.entries(query.filters).some(([k,v])=>k==='currency'?!/^[A-Z]{3}$/.test(v):! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)))throw new UnprocessableEntityException({code:'INVALID_PROJECTION_SCOPE'});
 if(treeGroup&&(query.time.ruleVersion||query.time.settlementId))throw new UnprocessableEntityException({code:'UNSUPPORTED_TREE_TIME_FILTER'});
 if(query.time.settlementId&&query.filters.settlementId&&query.time.settlementId!==query.filters.settlementId)throw new UnprocessableEntityException({code:'CONFLICTING_SETTLEMENT_FILTER'});
 if(group==='CARRY'&&(!query.filters.qualificationId||query.time.ruleVersion||query.time.settlementId))throw new UnprocessableEntityException({code:'CARRY_QUALIFICATION_SCOPE_REQUIRED'});
 if(treeGroup&&metric!=='tree.comparison'&&!query.filters.binaryTreeId)throw new UnprocessableEntityException({code:'TREE_SCOPE_REQUIRED'});
 return group;
}
/** Only fixed, parameterized authoritative reads. No executable SQL comes from a query. */
export async function projectPeriodFacts(tx:Prisma.TransactionClient,query:AnalyticsQuery):Promise<ProjectedFacts>{
 const group=projectionGroup(query),metric=query.metrics[0],t=query.time,at=new Date(t.asOf),known=new Date(t.knowledgeCutoff),start=new Date(t.periodStart),end=new Date(t.periodEnd);
 if(group==='CARRY')return projectCarry(tx,query);
 if(metric==='tree.comparison')return projectTreeComparison(tx,query);
 if(group==='BONUS')return projectBonusDistribution(tx,query);
 if(group==='FOUNDING')return projectFoundingFacts(tx,query);
 if(group==='RETURN')return projectReturnCohort(tx,query);
 if(group==='TREE'){
  const id=query.filters.binaryTreeId;
  const rows=await tx.$queryRaw<Array<{balls:string;monthly:string;last:Date|null}>>`SELECT count(*)::text balls,
   count(*) FILTER(WHERE m.effective_from>=${start} AND m.effective_from<${end} AND m.effective_from<${at})::text monthly,
   max(m.recorded_at) last FROM organization.binary_tree_membership m
   JOIN organization.placement_tree_evidence e ON e.placement_tree_evidence_id=m.placement_tree_evidence_id
   WHERE m.binary_tree_id=${id}::uuid AND m.effective_from<=${at} AND m.recorded_at<=${known}
    AND e.effective_at=m.effective_from AND e.recorded_at<=${known}`;
  const [expected]=await tx.$queryRaw<Array<{balls:string}>>`SELECT count(*)::text balls FROM organization.binary_tree_membership
   WHERE binary_tree_id=${id}::uuid AND effective_from<=${at} AND recorded_at<=${known}`;
  const [tree]=await tx.$queryRaw<any[]>`SELECT binary_tree_id FROM organization.company_sponsor_designation WHERE binary_tree_id=${id}::uuid AND effective_at<=${at} AND recorded_at<=${known}`;
  if(!tree||rows[0].balls!==expected.balls)throw Error('TREE_PLACEMENT_EVIDENCE_INCOMPLETE');
  return {status:'CURRENT',manifest:{metric,grain:'TREE_PERIOD',population:'ALL_PLACED_QUALIFICATIONS',newBallDefinition:'FIRST_EFFECTIVE_BINARY_PLACEMENT',excludeTransfers:true,source:'BinaryTreeMembership/PlacementTreeEvidence',sourceCount:rows[0].balls,lastRecordedAt:rows[0].last?.toISOString()??null},rows:[{key:id,dimensions:{binaryTreeId:id},measures:{balls:rows[0].balls,monthlyNewBalls:rows[0].monthly},evidence:{source:'IMMUTABLE_PLACEMENT'}}]};
 }
 if(metric==='rank.new_achievements'){
  const id=query.filters.binaryTreeId;
  const rows=await tx.$queryRaw<any[]>`SELECT r.rank_code::text rank,
   count(*) FILTER(WHERE owner.n=1 AND owner.kind='MEMBER')::text achievements,
   count(*) FILTER(WHERE owner.n<>1)::text unknown_owner
   FROM ledger.qualification_global_rank_history r
   JOIN organization.binary_tree_membership m ON m.qualification_id=r.qualification_id AND m.binary_tree_id=${id}::uuid
   LEFT JOIN LATERAL(SELECT count(*) n,min(owner_type::text) kind FROM membership.qualification_owner_interval o
    WHERE o.qualification_id=r.qualification_id AND o.effective_from<=r.achieved_at AND o.recorded_at<=${known}
     AND(o.effective_to IS NULL OR o.effective_to>r.achieved_at OR o.closed_recorded_at>${known}))owner ON true
   WHERE r.achieved_at>=${start} AND r.achieved_at<${end} AND r.achieved_at<=${at} AND r.created_at<=${known}
    AND m.effective_from<=r.achieved_at AND m.recorded_at<=${known}
   GROUP BY r.rank_code ORDER BY r.rank_code`;
  const unknown=rows.reduce((n,r)=>n+BigInt(r.unknown_owner),0n);
  return {status:unknown===0n?'CURRENT':'STALE',manifest:{metric,grain:'QUALIFICATION_RANK_ACHIEVEMENT',population:'MEMBER_OWNER_AT_ACHIEVEMENT',basis:'EACH_FIRST_ACHIEVED_RANK_IN_PERIOD',multiplePromotions:'ONE_BALL_MAY_APPEAR_IN_MULTIPLE_RANKS',unknownOwnerCount:unknown.toString()},
   rows:rows.map(r=>({key:r.rank,dimensions:{binaryTreeId:id,rank:r.rank},measures:{newAchievements:r.achievements},evidence:{source:'QualificationGlobalRankHistory/OwnerInterval',unique:'qualificationId/rankCode'}}))};
 }
 if(group==='RANK'||group==='ACTIVE'){
  const id=query.filters.binaryTreeId;
  const rows=await tx.$queryRaw<Array<any>>`WITH checkpoint AS (SELECT least(${at}::timestamptz,${end}::timestamptz-interval '1 microsecond') t),
   population AS (
    SELECT m.qualification_id,o.owner_type,o.n,state.status_n,state.status_code,coalesce(r.rank,'UNRANKED') rank,r.achieved_at,
     gpv.gpv,gpv.invalid_gpv,
     ai.active_from,ai.active_to,ac.cumulative_after,ac.active_threshold
    FROM organization.binary_tree_membership m CROSS JOIN checkpoint c
    LEFT JOIN LATERAL (SELECT min(owner_type::text) owner_type,count(*) n FROM membership.qualification_owner_interval
     WHERE qualification_id=m.qualification_id AND effective_from<=c.t AND recorded_at<=${known}
      AND (effective_to IS NULL OR effective_to>c.t OR closed_recorded_at>${known})) o ON true
    LEFT JOIN LATERAL(SELECT count(*) status_n,min(status::text) status_code FROM membership.qualification_status_history
     WHERE qualification_id=m.qualification_id AND effective_from<=c.t AND created_at<=${known}
      AND(effective_to IS NULL OR effective_to>c.t))state ON true
    LEFT JOIN LATERAL (SELECT rank_code::text rank,achieved_at FROM ledger.qualification_global_rank_history
     WHERE qualification_id=m.qualification_id AND achieved_at<=c.t AND created_at<=${known}
     ORDER BY CASE rank_code::text WHEN 'CROWN' THEN 5 WHEN 'DIAMOND' THEN 4 WHEN 'GLORY' THEN 3 WHEN 'EXCELLENCE' THEN 2 WHEN 'NEW_STAR' THEN 1 ELSE 0 END DESC LIMIT 1) r ON true
    LEFT JOIN LATERAL (SELECT active_from,active_to FROM ledger.active_interval_evidence
     WHERE qualification_id=m.qualification_id AND calendar_month=date_trunc('month',c.t AT TIME ZONE 'Asia/Taipei')::date AND created_at<=${known}
     ORDER BY created_at DESC,active_interval_evidence_id DESC LIMIT 1) ai ON true
    LEFT JOIN LATERAL (SELECT cumulative_after,active_threshold FROM ledger.qualification_month_accumulator_evidence
     WHERE qualification_id=m.qualification_id AND calendar_month=date_trunc('month',c.t AT TIME ZONE 'Asia/Taipei')::date AND recorded_at<=${known}
     ORDER BY sequence_no DESC LIMIT 1) ac ON true
    LEFT JOIN LATERAL(SELECT coalesce(sum(e.amount+coalesce(v.delta,0)),0) gpv,
      count(*) FILTER(WHERE e.amount+coalesce(v.delta,0)<0) invalid_gpv
     FROM ledger.pv_ledger e LEFT JOIN LATERAL(SELECT sum(amount) delta FROM ledger.pv_ledger
      WHERE reversal_of_event_id=e.event_id AND recorded_at<=${known})v ON true
     WHERE e.qualification_id=m.qualification_id AND e.pv_type='GPV' AND e.event_type='GPV_CREATED' AND e.reversal_of_event_id IS NULL
      AND e.occurred_at>=${start} AND e.occurred_at<${end} AND e.occurred_at<=${at} AND e.recorded_at<=${known}) gpv ON true
    WHERE m.binary_tree_id=${id}::uuid AND m.effective_from<=c.t AND m.recorded_at<=${known}
   ) SELECT rank,coalesce(sum(gpv) FILTER(WHERE n=1 AND owner_type='MEMBER' AND status_n=1 AND status_code='EFFECTIVE'),0)::text gpv,
    coalesce(sum(invalid_gpv),0)::text invalid_gpv,
    count(*) FILTER(WHERE n=1 AND owner_type='MEMBER' AND status_n=1 AND status_code='EFFECTIVE' AND achieved_at>=${start} AND achieved_at<${end})::text new_achievements,
    count(*) FILTER(WHERE n=1 AND owner_type='MEMBER' AND status_n=1 AND status_code='EFFECTIVE')::text members,
    count(*) FILTER(WHERE n<>1)::text unknown_owner,
    count(*) FILTER(WHERE n=1 AND owner_type='MEMBER' AND status_n<>1)::text unknown_status,
    count(*) FILTER(WHERE n=1 AND owner_type='MEMBER' AND status_n=1 AND status_code<>'EFFECTIVE')::text excluded_status,
    count(*) FILTER(WHERE n=1 AND owner_type='COMPANY')::text excluded_company,
    count(*) FILTER(WHERE n=1 AND owner_type='MEMBER' AND status_n=1 AND status_code='EFFECTIVE' AND active_from<=c.t AND active_to>c.t)::text active,
    count(*) FILTER(WHERE n=1 AND owner_type='MEMBER' AND status_n=1 AND status_code='EFFECTIVE' AND (active_from IS NOT NULL OR cumulative_after<active_threshold))::text complete
   FROM population CROSS JOIN checkpoint c GROUP BY rank ORDER BY rank`;
  const sum=(field:string)=>rows.reduce((n,r)=>n+BigInt(r[field]),0n);
  const members=sum('members'),unknown=sum('unknown_owner'),active=sum('active'),complete=sum('complete');
  const [pending]=await tx.$queryRaw<any[]>`SELECT count(*)::text n FROM commerce.return_case r WHERE r.status='POSTED' AND r.posted_at<=${known} AND r.posted_at<=${at}
   AND NOT EXISTS(SELECT 1 FROM audit.audit_event a WHERE a.action='RETURN_REVERSAL_PROCESSED' AND a.entity_id=r.return_case_id AND a.occurred_at<=${known})`;
  const completeness=await financialCompleteness(tx,t);
  const incomplete=((group==='ACTIVE'||metric==='rank.gpv')&&completeness.status!=='CURRENT')||unknown>0n||sum('unknown_status')>0n||(group==='ACTIVE'&&complete!==members)||(metric==='rank.gpv'&&(sum('invalid_gpv')>0n||pending.n!=='0'));
  const rankMeasures=(r:any):ProjectionRow['measures']=>{
   if(metric==='rank.gpv')return {gpv:r.gpv,count:r.members};
   if(metric==='rank.new_achievements')return {newAchievements:r.new_achievements};
   return {count:r.members,active:r.complete===r.members?r.active:null,completeActive:r.complete};
  };
  return {status:incomplete?'STALE':'CURRENT',manifest:{metric,grain:'QUALIFICATION_PERIOD',rankBasis:'GLOBAL_CUMULATIVE',population:'HISTORICAL_EFFECTIVE_MEMBER_OWNER',eligibleCount:members.toString(),unknownOwnerCount:unknown.toString(),unknownStatusCount:sum('unknown_status').toString(),excludedNonEffectiveCount:sum('excluded_status').toString(),excludedCompanyCount:sum('excluded_company').toString(),completeCount:complete.toString(),checkpoint:'min(asOf,periodEnd-1microsecond)',zeroDenominator:'NULL_NO_POPULATION',gpvBasis:'OWN_QUALIFICATION_RESTATED_RECOGNITION_PERIOD',pendingReturnReplay:pending.n,nextRankPipeline:'SOURCE_NOT_AVAILABLE',completeness},
   rows:group==='RANK'?rows.map<ProjectionRow>(r=>({key:r.rank,dimensions:{binaryTreeId:id,rank:r.rank},measures:rankMeasures(r),evidence:{source:'QualificationGlobalRankHistory/OwnerInterval/ActiveIntervalEvidence'}})):
   [{key:id,dimensions:{binaryTreeId:id},measures:{numerator:active.toString(),denominator:members.toString(),rate:members===0n||incomplete?null:new Prisma.Decimal(active.toString()).div(members.toString()).toFixed(8)},evidence:{source:'ActiveIntervalEvidence/QualificationMonthAccumulatorEvidence',missingHistory:'UNAVAILABLE_NOT_ZERO'}}]};
 }
 const settlement=query.filters.settlementId??t.settlementId;
 const rule=t.ruleVersion;
 if(group==='K'){
  const kind=metric==='pool.k0'?'REFERRAL_K0':metric==='pool.k1'?'BINARY_K1':'MATCHING_K2';
  const rows=await tx.$queryRaw<Array<any>>(Prisma.sql`SELECT b.settlement_batch_id::text id,coalesce(r.k_factor,b.k_factor)::text k,coalesce(r.total_theory,b.total_theory)::text theory,coalesce(r.pool_available,b.pool_available)::text pool,coalesce(r.state_hash,b.calculation_hash) hash,b.parameter_snapshot snapshot,coalesce(r.recorded_at,b.finalized_at) recorded,r.sequence::text replay_sequence,
   EXISTS(SELECT 1 FROM ledger.entitlement_replay_posting p JOIN ledger.historical_replay_snapshot s USING(snapshot_id)
    WHERE s.source_id=b.settlement_batch_id AND p.created_at<=${known} AND NOT EXISTS(SELECT 1 FROM ledger.settlement_replay_metric represented WHERE represented.settlement_batch_id=b.settlement_batch_id AND represented.snapshot_id=p.snapshot_id AND represented.action_key=p.action_key AND represented.state_hash=p.state_hash AND represented.recorded_at<=${known})) unrepresented_replay
   FROM ledger.settlement_batch b LEFT JOIN LATERAL(SELECT * FROM ledger.settlement_replay_metric WHERE settlement_batch_id=b.settlement_batch_id AND recorded_at<=${known} ORDER BY sequence DESC LIMIT 1) r ON true
   WHERE settlement_type::text=${kind} AND status='FINALIZED'
   AND period_start>=${start} AND period_start<${end} AND period_end<=${at} AND finalized_at<=${known}
   ${rule?Prisma.sql`AND rule_version_code=${rule}`:Prisma.empty}
   ${settlement?Prisma.sql`AND b.settlement_batch_id=${settlement}::uuid`:Prisma.empty} ORDER BY b.settlement_batch_id LIMIT 10001`);
  const [pending]=await tx.$queryRaw<Array<{n:string}>>`SELECT count(*)::text n FROM ledger.settlement_recalculation_request
   WHERE period_end>=${start} AND period_end<=${end} AND created_at<=${known} AND (processed_at IS NULL OR processed_at>${known})`;
  const completeness=await financialCompleteness(tx,t);
  return {status:pending.n==='0'&&completeness.status==='CURRENT'&&!rows.some(r=>r.unrepresented_replay)?'CURRENT':'STALE',manifest:{metric,completeness,unrepresentedReplay:rows.filter(r=>r.unrepresented_replay).length,grain:'SETTLEMENT',source:'SettlementBatch',basis:'FINALIZED_PLUS_LATEST_CORE_REPLAY',pendingReplay:pending.n,sourceCount:rows.length},
   rows:rows.map(r=>({key:r.id,dimensions:{settlementId:r.id},measures:{k:r.k,theory:r.theory,pool:r.pool},evidence:{replaySequence:r.replay_sequence??null,hash:r.hash,snapshotHash:r.snapshot?.hash??null,recordedAt:r.recorded.toISOString()}}))};
 }
 const completeness=await financialCompleteness(tx,t);
 if(metric==='reservoir.a'){
  const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT source_global_settlement_id::text id,sum(amount)::text amount,count(*)::text effects,max(created_at) updated
   FROM ledger.reservoir_ledger_effect WHERE reservoir_code='A' AND source_period_start>=${start} AND source_period_start<${end} AND source_period_end<=${at} AND created_at<=${known}
   ${rule?Prisma.sql`AND rule_version_code=${rule}`:Prisma.empty}
   ${settlement?Prisma.sql`AND source_global_settlement_id=${settlement}::uuid`:Prisma.empty} GROUP BY source_global_settlement_id ORDER BY source_global_settlement_id LIMIT 10001`);
  return {status:completeness.status,manifest:{metric,completeness,grain:'SETTLEMENT',source:'ReservoirLedgerEffect',basis:'POSTED_LEDGER_NET',sourceCount:rows.length},rows:rows.map(r=>({key:r.id,dimensions:{settlementId:r.id},measures:{amount:r.amount},evidence:{effects:r.effects,updatedAt:r.updated.toISOString()}}))};
 }
 const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT d.destination_id::text id,d.source_settlement_id::text settlement,d.binary_tree_id::text tree,d.qualification_id::text qualification,d.award_type,
  d.snapshot_hash,sum(e.amount_delta)::text amount,count(*)::text effects,max(e.recorded_at) updated
  FROM ledger.reservoir_b_effect e JOIN ledger.award_economic_destination d USING(destination_id)
  WHERE d.period_start>=${start} AND d.period_start<${end} AND e.effective_at<=${at} AND e.recorded_at<=${known}
  ${rule?Prisma.sql`AND d.rule_version=${rule}`:Prisma.empty}
  ${settlement?Prisma.sql`AND d.source_settlement_id=${settlement}::uuid`:Prisma.empty}
  GROUP BY d.destination_id ORDER BY d.destination_id LIMIT 10001`);
 return {status:completeness.status,manifest:{metric,completeness,grain:'QUALIFICATION_ENTITLEMENT',source:'ReservoirBEffect/AwardEconomicDestination',basis:'POSTED_LEDGER_NET',sourceCount:rows.length},
  rows:rows.map(r=>({key:r.id,dimensions:{settlementId:r.settlement??'RECOGNITION',binaryTreeId:r.tree,qualificationId:r.qualification,awardType:r.award_type},measures:{amount:r.amount},evidence:{snapshotHash:r.snapshot_hash,effects:r.effects,updatedAt:r.updated.toISOString()}}))};
}
