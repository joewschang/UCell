CREATE TABLE ledger.historical_replay_snapshot (
 snapshot_id uuid PRIMARY KEY, kind text NOT NULL, source_id uuid NOT NULL,
 rule_version_code text NOT NULL, content jsonb NOT NULL, hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind,source_id)
);
CREATE TABLE ledger.entitlement_replay_posting (
 posting_id uuid PRIMARY KEY, sequence bigserial UNIQUE NOT NULL, action_key text NOT NULL,
 snapshot_id uuid NOT NULL REFERENCES ledger.historical_replay_snapshot(snapshot_id),
 entitlement_key text NOT NULL, recipient_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 originally_posted numeric(18,4) NOT NULL CHECK(originally_posted>=0),
 recalculated_entitlement numeric(18,4) NOT NULL CHECK(recalculated_entitlement>=0), delta numeric(18,4) NOT NULL,
 state_hash text NOT NULL, correction_award_id uuid REFERENCES ledger.bonus_award(bonus_award_id),
 recovery_id uuid REFERENCES ledger.bonus_recovery_event(bonus_recovery_event_id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(action_key,snapshot_id,entitlement_key)
);
CREATE INDEX ON ledger.entitlement_replay_posting(snapshot_id,entitlement_key);
CREATE TABLE ledger.replay_action(action_key text PRIMARY KEY,state_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ledger.replay_carry_projection (
 sequence bigserial PRIMARY KEY, action_key text NOT NULL, settlement_batch_id uuid NOT NULL REFERENCES ledger.settlement_batch(settlement_batch_id),
 period_end timestamptz NOT NULL, rule_version_code text NOT NULL, carry jsonb NOT NULL,state_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(action_key,settlement_batch_id)
);
CREATE INDEX ON ledger.replay_carry_projection(period_end,rule_version_code);
CREATE FUNCTION ledger.reject_replay_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'APPEND_ONLY_REPLAY_EVIDENCE'; END $$;
CREATE TRIGGER immutable_snapshot BEFORE UPDATE OR DELETE ON ledger.historical_replay_snapshot FOR EACH ROW EXECUTE FUNCTION ledger.reject_replay_mutation();
CREATE TRIGGER immutable_posting BEFORE UPDATE OR DELETE ON ledger.entitlement_replay_posting FOR EACH ROW EXECUTE FUNCTION ledger.reject_replay_mutation();
CREATE TRIGGER immutable_action BEFORE UPDATE OR DELETE ON ledger.replay_action FOR EACH ROW EXECUTE FUNCTION ledger.reject_replay_mutation();
CREATE TRIGGER immutable_carry BEFORE UPDATE OR DELETE ON ledger.replay_carry_projection FOR EACH ROW EXECUTE FUNCTION ledger.reject_replay_mutation();
CREATE FUNCTION ledger.verify_replay_delta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior numeric; original numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.snapshot_id::text||':'||NEW.entitlement_key,0));
 SELECT COALESCE(SUM(delta),0),MIN(originally_posted) INTO prior,original FROM ledger.entitlement_replay_posting WHERE snapshot_id=NEW.snapshot_id AND entitlement_key=NEW.entitlement_key;
 IF original IS NOT NULL AND original<>NEW.originally_posted THEN RAISE EXCEPTION 'REPLAY_ORIGINAL_BASELINE_CHANGED'; END IF;
 IF NEW.delta<>NEW.recalculated_entitlement-NEW.originally_posted-prior THEN RAISE EXCEPTION 'REPLAY_DELTA_BASELINE_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER verify_delta BEFORE INSERT ON ledger.entitlement_replay_posting FOR EACH ROW EXECUTE FUNCTION ledger.verify_replay_delta();
