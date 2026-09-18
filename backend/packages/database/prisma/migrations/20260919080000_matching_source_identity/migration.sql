-- Matching is an allocation of one specific source Binary Award to a fixed Sponsor generation.
-- Preserve the existing non-Matching key; include source_award_id for Matching only.
DROP INDEX ledger.uq_bonus_award_source;
CREATE UNIQUE INDEX uq_bonus_award_source ON ledger.bonus_award(
 award_type,recipient_qualification_id,
 COALESCE(source_event_id,'00000000-0000-0000-0000-000000000000'::uuid),
 COALESCE(generation_no,0),
 COALESCE(settlement_batch_id,'00000000-0000-0000-0000-000000000000'::uuid),
 (CASE WHEN award_type='MATCHING' THEN COALESCE(source_award_id,'00000000-0000-0000-0000-000000000000'::uuid)
 ELSE '00000000-0000-0000-0000-000000000000'::uuid END));
