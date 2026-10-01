import {Prisma} from '@ucell/database';
/** One eligibility predicate for aging and the missing-payable source queue. */
export function maturedPayableSourceSql(cutoff:Date,asOf:Date){return Prisma.sql`
 SELECT 'BONUS_AWARD'::text source_type,a.bonus_award_id source_id,a.recipient_qualification_id qualification_id,a.award_type::text award_type,a.payable_amount amount,a.pending_until matures_at,a.rule_version_code,a.created_at
 FROM ledger.bonus_award a WHERE a.pending_until<=${cutoff} AND a.created_at<=${asOf} AND a.payable_amount>0
 AND EXISTS(SELECT 1 FROM ledger.bonus_award_lifecycle_event l WHERE l.bonus_award_id=a.bonus_award_id AND l.status='EFFECTIVE')
 AND NOT EXISTS(SELECT 1 FROM ledger.award_economic_destination d WHERE d.source_bonus_award_id=a.bonus_award_id)
 AND NOT EXISTS(SELECT 1 FROM ledger.payable_entry p WHERE p.source_type='BONUS_AWARD' AND p.source_id=a.bonus_award_id)
 UNION ALL
 SELECT 'RPV_UPLINE_AWARD',a.rpv_award_event_id,a.recipient_qualification_id,'RPV',a.payable_amount,a.occurred_at,a.rule_version_code,a.created_at
 FROM ledger.rpv_upline_award_event a WHERE a.occurred_at<=${cutoff} AND a.created_at<=${asOf} AND a.payable_amount>0
 AND NOT EXISTS(SELECT 1 FROM ledger.award_economic_destination d WHERE d.source_rpv_award_id=a.rpv_award_event_id)
 AND NOT EXISTS(SELECT 1 FROM ledger.payable_entry p WHERE p.source_type='RPV_UPLINE_AWARD' AND p.source_id=a.rpv_award_event_id)
 UNION ALL
 SELECT 'GLOBAL_POOL_AWARD',a.global_pool_award_id,a.qualification_id,'GLOBAL',a.payable_amount,s.period_end,s.rule_version_code,a.created_at
 FROM ledger.global_pool_award a JOIN ledger.global_pool_settlement s ON s.global_pool_settlement_id=a.global_pool_settlement_id
 WHERE s.period_end<=${cutoff} AND a.created_at<=${asOf} AND a.payable_amount>0
 AND NOT EXISTS(SELECT 1 FROM ledger.award_economic_destination d WHERE d.source_global_award_id=a.global_pool_award_id)
 AND NOT EXISTS(SELECT 1 FROM ledger.payable_entry p WHERE p.source_type='GLOBAL_POOL_AWARD' AND p.source_id=a.global_pool_award_id)
`;}
