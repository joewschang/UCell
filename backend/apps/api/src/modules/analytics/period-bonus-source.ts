import {financialCompleteness} from './financial-completeness';
import {Prisma} from '@ucell/database';
import {AnalyticsQuery} from '@ucell/shared';
import {BONUS_BANDS,BONUS_BAND_DEFINITION_VERSION} from './bonus-bands.config';
import type {ProjectedFacts} from './period-projection-sources';
/** Aggregate persisted entitlements only; Core remains the sole calculator. */
export async function projectBonusDistribution(tx:Prisma.TransactionClient,query:AnalyticsQuery):Promise<ProjectedFacts>{
 const t=query.time,id=query.filters.binaryTreeId,at=new Date(t.asOf),known=new Date(t.knowledgeCutoff),start=new Date(t.periodStart),end=new Date(t.periodEnd);
 const bands=BONUS_BANDS.map((b,index)=>({...b,index}));
 const rows=await tx.$queryRaw<any[]>`
 WITH checkpoint AS(SELECT least(${at}::timestamptz,${end}::timestamptz-interval '1 microsecond') at),
 population AS(
  SELECT m.qualification_id,o.kind,o.n,state.status_n,state.status_code,coalesce(rank.rank,'UNRANKED') rank FROM organization.binary_tree_membership m CROSS JOIN checkpoint c
  LEFT JOIN LATERAL(SELECT count(*) n,min(owner_type::text) kind FROM membership.qualification_owner_interval
   WHERE qualification_id=m.qualification_id AND effective_from<=c.at AND recorded_at<=${known}
    AND(effective_to IS NULL OR effective_to>c.at OR closed_recorded_at>${known}))o ON true
  LEFT JOIN LATERAL(SELECT count(*) status_n,min(status::text) status_code FROM membership.qualification_status_history
   WHERE qualification_id=m.qualification_id AND effective_from<=c.at AND created_at<=${known}
    AND(effective_to IS NULL OR effective_to>c.at))state ON true
  LEFT JOIN LATERAL(SELECT rank_code::text rank FROM ledger.qualification_global_rank_history
   WHERE qualification_id=m.qualification_id AND achieved_at<=c.at AND created_at<=${known}
   ORDER BY CASE rank_code::text WHEN 'CROWN' THEN 5 WHEN 'DIAMOND' THEN 4 WHEN 'GLORY' THEN 3 WHEN 'EXCELLENCE' THEN 2 WHEN 'NEW_STAR' THEN 1 ELSE 0 END DESC LIMIT 1) rank ON true
  WHERE m.binary_tree_id=${id}::uuid AND m.effective_from<=c.at AND m.recorded_at<=${known}
 ), originals AS(
  SELECT a.bonus_award_id id,a.recipient_qualification_id qid,a.payable_amount amount,'BONUS' kind
  FROM ledger.bonus_award a LEFT JOIN ledger.settlement_batch b USING(settlement_batch_id)
  WHERE a.occurred_at>=${start} AND a.occurred_at<${end} AND a.occurred_at<=${at} AND a.created_at<=${known}
   AND(a.settlement_batch_id IS NULL OR(b.status='FINALIZED' AND b.finalized_at<=${known}))
   AND coalesce(a.calculation_detail->>'subtype','') NOT LIKE 'HISTORICAL_%'
  UNION ALL SELECT a.rpv_award_event_id,a.recipient_qualification_id,a.payable_amount,'RPV'
   FROM ledger.rpv_upline_award_event a
   WHERE a.occurred_at>=${start} AND a.occurred_at<${end} AND a.occurred_at<=${at} AND a.created_at<=${known}
  UNION ALL SELECT a.global_pool_award_id,a.qualification_id,a.payable_amount,'GLOBAL'
   FROM ledger.global_pool_award a JOIN ledger.global_pool_settlement s USING(global_pool_settlement_id)
   WHERE s.period_start>=${start} AND s.period_start<${end} AND s.period_end<=${at} AND a.created_at<=${known}
 ), member_awards AS(
  SELECT a.* FROM originals a JOIN population p ON p.qualification_id=a.qid AND p.n=1 AND p.kind='MEMBER' AND p.status_n=1 AND p.status_code='EFFECTIVE'
  WHERE NOT EXISTS(SELECT 1 FROM ledger.award_economic_destination d
   WHERE (a.kind='BONUS' AND d.source_bonus_award_id=a.id) OR(a.kind='RPV' AND d.source_rpv_award_id=a.id) OR(a.kind='GLOBAL' AND d.source_global_award_id=a.id))
 ), net AS(
  SELECT a.qid,a.amount+coalesce(r.delta,0) amount FROM member_awards a
  LEFT JOIN LATERAL(
   SELECT sum(p.delta) delta FROM ledger.entitlement_replay_posting p
    JOIN ledger.historical_replay_snapshot s USING(snapshot_id)
   WHERE p.recipient_qualification_id=a.qid AND p.created_at<=${known} AND p.created_at<=${at}
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.content->'recipients') recipient
     WHERE recipient->>'key'=p.entitlement_key AND recipient->>'awardId'=a.id::text)
  )r ON true
 ), totals AS(
  SELECT p.qualification_id,p.rank,coalesce(sum(n.amount),0) amount FROM population p LEFT JOIN net n ON n.qid=p.qualification_id
  WHERE p.n=1 AND p.kind='MEMBER' AND p.status_n=1 AND p.status_code='EFFECTIVE' GROUP BY p.qualification_id,p.rank
 ), bands AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(bands)}::jsonb) AS b(key text,lower numeric,upper numeric,index integer))
 SELECT b.key,b.index,count(t.qualification_id)::text members,coalesce(sum(t.amount),0)::text total,
  (SELECT count(*)::text FROM population WHERE n<>1) unknown_owner,
  (SELECT count(*)::text FROM population WHERE n=1 AND kind='MEMBER' AND status_n<>1) unknown_status,
  (SELECT count(*)::text FROM population WHERE n=1 AND kind='COMPANY') excluded_company,
  (SELECT count(*)::text FROM totals WHERE amount<0) negative_entitlements,
  (SELECT count(*)::text FROM totals) population,
  (SELECT coalesce(jsonb_agg(r ORDER BY r.rank),'[]'::jsonb) FROM(SELECT rank,count(*)::text count,sum(amount)::text amount FROM totals GROUP BY rank)r) rank_totals
 FROM bands b LEFT JOIN totals t ON(b.key='0' AND t.amount=0) OR(b.key<>'0' AND t.amount>b.lower AND(b.upper IS NULL OR t.amount<=b.upper))
 GROUP BY b.key,b.index ORDER BY b.index`;
 const [pending]=await tx.$queryRaw<any[]>`SELECT count(*)::text n FROM ledger.settlement_recalculation_request
  WHERE period_end>=${start} AND period_start<${end} AND created_at<=${known} AND(processed_at IS NULL OR processed_at>${known})`;
 const [unsettled]=await tx.$queryRaw<any[]>`SELECT count(*)::text n FROM ledger.pv_ledger e
  JOIN organization.binary_tree_membership m ON m.qualification_id=e.qualification_id
  WHERE m.binary_tree_id=${id}::uuid AND m.effective_from<=e.occurred_at AND m.recorded_at<=${known}
   AND e.pv_type='GPV' AND e.event_type='GPV_CREATED' AND e.occurred_at>=${start} AND e.occurred_at<${end} AND e.occurred_at<=${at} AND e.recorded_at<=${known}
   AND EXISTS(SELECT 1 FROM (VALUES('REFERRAL_K0'),('BINARY_K1'),('MATCHING_K2'))required(kind)
    WHERE NOT EXISTS(SELECT 1 FROM ledger.settlement_batch b WHERE b.settlement_type::text=required.kind AND b.rule_version_code=e.rule_version_code
     AND b.period_start<=e.occurred_at AND b.period_end>e.occurred_at AND b.status='FINALIZED' AND b.finalized_at<=${known} AND b.period_end<=${at}))`;
 const completeness=await financialCompleteness(tx,t);
 const complete=completeness.status==='CURRENT'&&rows[0].unknown_owner==='0'&&rows[0].unknown_status==='0'&&rows[0].negative_entitlements==='0'&&pending.n==='0'&&unsettled.n==='0';
 return {status:complete?'CURRENT':'STALE',manifest:{metric:query.metrics[0],grain:'QUALIFICATION_PERIOD',population:'HISTORICAL_EFFECTIVE_MEMBER_OWNER_IN_TREE',populationCount:rows[0].population,
  excludedCompanyCount:rows[0].excluded_company,unknownOwnerCount:rows[0].unknown_owner,unknownStatusCount:rows[0].unknown_status,negativeEntitlements:rows[0].negative_entitlements,pendingReplay:pending.n,pendingSourceCount:unsettled.n,unsettledPolicy:'NO_ZERO_INCOME_FROM_UNFINALIZED_GPV',completeness,
  bandDefinitionVersion:BONUS_BAND_DEFINITION_VERSION,bands,boundary:'ZERO_OR_(LOWER,UPPER]',basis:'ORIGINAL_FINAL_PLUS_SIGNED_REPLAY',payoutStatus:'NOT_A_PAYMENT_REPORT'},
  rows:!complete?[]:query.metrics[0]==='rank.bonus'?rows[0].rank_totals.map((r:any)=>({key:r.rank,dimensions:{binaryTreeId:id,rank:r.rank},measures:{count:r.count,totalEntitlement:r.amount},evidence:{source:'OriginalFinal+EntitlementReplayPosting',rankBasis:'GLOBAL_CUMULATIVE_AT_CHECKPOINT'}})):rows.map(r=>({key:String(r.index),dimensions:{binaryTreeId:id,band:r.key},measures:{count:r.members,totalEntitlement:r.total},evidence:{source:'BonusAward/RpvUplineAwardEvent/GlobalPoolAward/EntitlementReplayPosting',bandDefinitionVersion:BONUS_BAND_DEFINITION_VERSION}}))};
}
