-- Final entitlements remain Core facts. Destination and Reservoir B effects are immutable sidecars.
CREATE TABLE ledger.award_economic_destination (
 destination_id uuid PRIMARY KEY,
 source_bonus_award_id uuid UNIQUE REFERENCES ledger.bonus_award(bonus_award_id),
 source_rpv_award_id uuid UNIQUE REFERENCES ledger.rpv_upline_award_event(rpv_award_event_id),
 source_global_award_id uuid UNIQUE REFERENCES ledger.global_pool_award(global_pool_award_id),
 qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 binary_tree_id uuid NOT NULL REFERENCES organization.binary_tree(binary_tree_id),
 owner_interval_id uuid NOT NULL REFERENCES membership.qualification_owner_interval(owner_interval_id),
 binding_id uuid REFERENCES membership.company_bootstrap_profile_binding(binding_id),
 company_position integer, destination text NOT NULL DEFAULT 'RESERVOIR_B' CHECK(destination='RESERVOIR_B'),
 award_type text NOT NULL, source_settlement_id uuid, period_start timestamptz(6) NOT NULL, period_end timestamptz(6) NOT NULL,
 final_amount numeric(18,4) NOT NULL CHECK(final_amount>=0),rule_version text NOT NULL,parameter_version text NOT NULL,
 snapshot_hash text NOT NULL,parameter_snapshot jsonb NOT NULL,effective_at timestamptz(6) NOT NULL,recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(source_bonus_award_id,source_rpv_award_id,source_global_award_id)=1),
 CHECK(period_end>period_start),CHECK(company_position IS NULL OR company_position BETWEEN 1 AND 3),
 CHECK(length(snapshot_hash)=64 AND length(parameter_version)=64));
CREATE INDEX award_destination_tree_period_idx ON ledger.award_economic_destination(binary_tree_id,period_start,destination_id);
CREATE TABLE ledger.reservoir_b_effect (
 effect_id uuid PRIMARY KEY,destination_id uuid NOT NULL REFERENCES ledger.award_economic_destination(destination_id),
 effect_type text NOT NULL CHECK(effect_type IN ('ENTITLEMENT','REPLAY_ADJUSTMENT')),
 replay_posting_id uuid UNIQUE REFERENCES ledger.entitlement_replay_posting(posting_id),
 amount_delta numeric(18,4) NOT NULL,effective_at timestamptz(6) NOT NULL,recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 idempotency_key text NOT NULL UNIQUE,
 CHECK((effect_type='ENTITLEMENT' AND replay_posting_id IS NULL AND amount_delta>=0) OR (effect_type='REPLAY_ADJUSTMENT' AND replay_posting_id IS NOT NULL)));
CREATE UNIQUE INDEX reservoir_b_original_once ON ledger.reservoir_b_effect(destination_id) WHERE effect_type='ENTITLEMENT';
CREATE INDEX reservoir_b_destination_recorded_idx ON ledger.reservoir_b_effect(destination_id,recorded_at,effect_id);
CREATE TRIGGER award_destination_immutable BEFORE UPDATE OR DELETE ON ledger.award_economic_destination FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER reservoir_b_effect_immutable BEFORE UPDATE OR DELETE ON ledger.reservoir_b_effect FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE FUNCTION ledger.ucell_verify_company_destination() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE qid uuid; amount numeric; at_time timestamptz; rule text; hash text; bootstrap boolean; expected_type text; expected_settlement uuid; period_from timestamptz; period_to timestamptz; zone text;
BEGIN
 IF NEW.source_bonus_award_id IS NOT NULL THEN
  SELECT recipient_qualification_id,payable_amount,occurred_at,rule_version_code,parameter_snapshot_hash,award_type::text,settlement_batch_id INTO qid,amount,at_time,rule,hash,expected_type,expected_settlement FROM ledger.bonus_award WHERE bonus_award_id=NEW.source_bonus_award_id;
 ELSIF NEW.source_rpv_award_id IS NOT NULL THEN
  SELECT recipient_qualification_id,payable_amount,occurred_at,rule_version_code,parameter_snapshot_hash INTO qid,amount,at_time,rule,hash FROM ledger.rpv_upline_award_event WHERE rpv_award_event_id=NEW.source_rpv_award_id;
  expected_type:='RPV';
 ELSE
  SELECT a.qualification_id,a.payable_amount,s.period_end,s.rule_version_code,s.parameter_snapshot->>'hash',s.global_pool_settlement_id,s.period_start,s.period_end INTO qid,amount,at_time,rule,hash,expected_settlement,period_from,period_to FROM ledger.global_pool_award a JOIN ledger.global_pool_settlement s USING(global_pool_settlement_id) WHERE a.global_pool_award_id=NEW.source_global_award_id;
  expected_type:='GLOBAL';
 END IF;
 IF NEW.source_bonus_award_id IS NOT NULL AND expected_settlement IS NOT NULL THEN
  SELECT period_start,period_end INTO period_from,period_to FROM ledger.settlement_batch WHERE settlement_batch_id=expected_settlement;
 ELSIF NEW.source_global_award_id IS NULL THEN
  SELECT p->>'value' INTO zone FROM jsonb_array_elements(NEW.parameter_snapshot->'parameters') p WHERE p->>'code'='accounting.timezone' AND p->>'scope'='*';
  IF zone IS NULL THEN RAISE EXCEPTION 'RESERVOIR_B_PERIOD_EVIDENCE_MISSING' USING ERRCODE='23514'; END IF;
  period_from:=date_trunc('month',at_time AT TIME ZONE zone) AT TIME ZONE zone;
  period_to:=(date_trunc('month',at_time AT TIME ZONE zone)+interval '1 month') AT TIME ZONE zone;
 END IF;
 IF NEW.award_type IS DISTINCT FROM expected_type OR NEW.source_settlement_id IS DISTINCT FROM expected_settlement
  OR NEW.period_start IS DISTINCT FROM period_from OR NEW.period_end IS DISTINCT FROM period_to
  OR NEW.parameter_snapshot->>'ruleVersionCode' IS DISTINCT FROM rule THEN RAISE EXCEPTION 'RESERVOIR_B_PERIOD_SOURCE_MISMATCH' USING ERRCODE='23514'; END IF;
 IF qid IS DISTINCT FROM NEW.qualification_id OR amount IS DISTINCT FROM NEW.final_amount OR at_time IS DISTINCT FROM NEW.effective_at OR rule IS DISTINCT FROM NEW.rule_version OR hash IS DISTINCT FROM NEW.snapshot_hash
  OR NEW.parameter_snapshot->>'hash' IS DISTINCT FROM NEW.snapshot_hash
  OR NOT EXISTS(SELECT 1 FROM membership.qualification_owner_interval o WHERE o.owner_interval_id=NEW.owner_interval_id AND o.qualification_id=qid AND o.owner_type='COMPANY' AND o.effective_from<=at_time AND (o.effective_to IS NULL OR o.effective_to>at_time))
  OR NOT EXISTS(SELECT 1 FROM organization.binary_tree_membership m WHERE m.qualification_id=qid AND m.binary_tree_id=NEW.binary_tree_id AND m.effective_from<=at_time)
 THEN RAISE EXCEPTION 'COMPANY_DESTINATION_SOURCE_MISMATCH' USING ERRCODE='23514'; END IF;
 SELECT kind='COMPANY_BOOTSTRAP' INTO bootstrap FROM membership.qualification WHERE qualification_id=qid;
 IF bootstrap AND NOT EXISTS(SELECT 1 FROM membership.company_bootstrap_profile_binding b WHERE b.binding_id=NEW.binding_id AND b.qualification_id=qid AND b.snapshot_hash=NEW.snapshot_hash AND b.parameter_version=NEW.parameter_version AND b.company_position=NEW.company_position) THEN
  RAISE EXCEPTION 'COMPANY_LEADER_BINDING_REQUIRED' USING ERRCODE='23514'; END IF;
 IF NOT bootstrap AND (NEW.binding_id IS NOT NULL OR NEW.company_position IS NOT NULL) THEN RAISE EXCEPTION 'MEMBER_ORIGIN_PROFILE_PRESERVED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER company_destination_source_guard BEFORE INSERT ON ledger.award_economic_destination FOR EACH ROW EXECUTE FUNCTION ledger.ucell_verify_company_destination();
CREATE FUNCTION ledger.ucell_verify_reservoir_b_effect() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d ledger.award_economic_destination; p ledger.entitlement_replay_posting;
BEGIN
 SELECT * INTO d FROM ledger.award_economic_destination WHERE destination_id=NEW.destination_id FOR UPDATE;
 IF NEW.effect_type='ENTITLEMENT' THEN
  IF NEW.amount_delta<>d.final_amount OR NEW.effective_at<>d.effective_at THEN RAISE EXCEPTION 'RESERVOIR_B_SOURCE_AMOUNT_MISMATCH' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO p FROM ledger.entitlement_replay_posting WHERE posting_id=NEW.replay_posting_id;
  IF p.recipient_qualification_id IS DISTINCT FROM d.qualification_id OR p.entitlement_key IS DISTINCT FROM coalesce(d.source_bonus_award_id,d.source_rpv_award_id,d.source_global_award_id)::text
   OR p.delta IS DISTINCT FROM NEW.amount_delta OR p.recovery_id IS NOT NULL OR p.correction_award_id IS NOT NULL THEN RAISE EXCEPTION 'RESERVOIR_B_REPLAY_MISMATCH' USING ERRCODE='23514'; END IF;
 END IF;
 IF coalesce((SELECT sum(amount_delta) FROM ledger.reservoir_b_effect WHERE destination_id=d.destination_id),0)+NEW.amount_delta<0 THEN RAISE EXCEPTION 'RESERVOIR_B_NEGATIVE_ENTITLEMENT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reservoir_b_effect_source_guard BEFORE INSERT ON ledger.reservoir_b_effect FOR EACH ROW EXECUTE FUNCTION ledger.ucell_verify_reservoir_b_effect();
-- Defer activation validation to commit so the existing Core can create its final fact and route it atomically.
DROP TRIGGER bootstrap_award_activation_closed ON ledger.bonus_award;
CREATE FUNCTION ledger.ucell_require_company_destination() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE qid uuid; at_time timestamptz; sid uuid; d ledger.award_economic_destination;
BEGIN
 IF TG_TABLE_NAME='bonus_award' THEN qid:=NEW.recipient_qualification_id;at_time:=NEW.occurred_at;sid:=NEW.bonus_award_id;
 ELSIF TG_TABLE_NAME='rpv_upline_award_event' THEN qid:=NEW.recipient_qualification_id;at_time:=NEW.occurred_at;sid:=NEW.rpv_award_event_id;
 ELSE qid:=NEW.qualification_id;sid:=NEW.global_pool_award_id;SELECT period_end INTO at_time FROM ledger.global_pool_settlement WHERE global_pool_settlement_id=NEW.global_pool_settlement_id;
 END IF;
 IF EXISTS(SELECT 1 FROM membership.qualification q WHERE q.qualification_id=qid AND q.kind='COMPANY_BOOTSTRAP')
 OR EXISTS(SELECT 1 FROM membership.qualification_owner_interval o WHERE o.qualification_id=qid AND o.owner_type='COMPANY' AND o.effective_from<=at_time AND (o.effective_to IS NULL OR o.effective_to>at_time)) THEN
  SELECT * INTO d FROM ledger.award_economic_destination WHERE source_bonus_award_id=sid OR source_rpv_award_id=sid OR source_global_award_id=sid;
  IF EXISTS(SELECT 1 FROM ledger.bonus_award_lifecycle_event WHERE bonus_award_id=sid) OR EXISTS(SELECT 1 FROM ledger.bonus_recovery_event WHERE bonus_award_id=sid) OR EXISTS(SELECT 1 FROM ledger.payable_entry WHERE source_id=sid) THEN RAISE EXCEPTION 'RESERVOIR_B_MEMBER_LIFECYCLE_FORBIDDEN' USING ERRCODE='23514'; END IF;
  IF d.destination_id IS NULL OR NOT EXISTS(SELECT 1 FROM ledger.reservoir_b_effect e WHERE e.destination_id=d.destination_id AND e.effect_type='ENTITLEMENT') THEN RAISE EXCEPTION 'COMPANY_ECONOMIC_DESTINATION_REQUIRED' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER company_bonus_destination_required AFTER INSERT ON ledger.bonus_award DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger.ucell_require_company_destination();
CREATE CONSTRAINT TRIGGER company_rpv_destination_required AFTER INSERT ON ledger.rpv_upline_award_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger.ucell_require_company_destination();
CREATE CONSTRAINT TRIGGER company_global_destination_required AFTER INSERT ON ledger.global_pool_award DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger.ucell_require_company_destination();
CREATE FUNCTION ledger.ucell_guard_company_member_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
 IF TG_TABLE_NAME='payable_entry' THEN sid:=NEW.source_id;
 ELSE sid:=NEW.bonus_award_id; END IF;
 IF EXISTS(SELECT 1 FROM ledger.award_economic_destination WHERE source_bonus_award_id=sid OR source_rpv_award_id=sid OR source_global_award_id=sid) THEN RAISE EXCEPTION 'RESERVOIR_B_MEMBER_LIFECYCLE_FORBIDDEN' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER company_payable_isolation BEFORE INSERT ON ledger.payable_entry FOR EACH ROW EXECUTE FUNCTION ledger.ucell_guard_company_member_lifecycle();
CREATE TRIGGER company_lifecycle_isolation BEFORE INSERT ON ledger.bonus_award_lifecycle_event FOR EACH ROW EXECUTE FUNCTION ledger.ucell_guard_company_member_lifecycle();
CREATE TRIGGER company_recovery_isolation BEFORE INSERT ON ledger.bonus_recovery_event FOR EACH ROW EXECUTE FUNCTION ledger.ucell_guard_company_member_lifecycle();
