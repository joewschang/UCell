CREATE OR REPLACE FUNCTION ledger.verify_replay_delta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior numeric; original numeric; recipient jsonb; matches integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.snapshot_id::text||':'||NEW.entitlement_key,0));
 SELECT COUNT(*) INTO matches FROM ledger.historical_replay_snapshot snapshot,
 LATERAL jsonb_array_elements(snapshot.content->'recipients') item
 WHERE snapshot.snapshot_id=NEW.snapshot_id AND item->>'key'=NEW.entitlement_key;
 IF matches<>1 THEN RAISE EXCEPTION 'HISTORICAL_SNAPSHOT_MISSING'; END IF;
 SELECT item INTO recipient FROM ledger.historical_replay_snapshot snapshot,
 LATERAL jsonb_array_elements(snapshot.content->'recipients') item
 WHERE snapshot.snapshot_id=NEW.snapshot_id AND item->>'key'=NEW.entitlement_key;
 IF recipient->>'qualificationId'<>NEW.recipient_qualification_id::text THEN RAISE EXCEPTION 'HISTORICAL_RECIPIENT_MISMATCH'; END IF;
 IF (recipient->>'posted')::numeric<>NEW.originally_posted THEN RAISE EXCEPTION 'REPLAY_ORIGINAL_BASELINE_CHANGED'; END IF;
 IF (recipient->>'eligible')::boolean IS NOT TRUE AND NEW.recalculated_entitlement>0 THEN RAISE EXCEPTION 'HISTORICAL_RECIPIENT_INELIGIBLE'; END IF;
 SELECT COALESCE(SUM(delta),0),MIN(originally_posted) INTO prior,original FROM ledger.entitlement_replay_posting WHERE snapshot_id=NEW.snapshot_id AND entitlement_key=NEW.entitlement_key;
 IF original IS NOT NULL AND original<>NEW.originally_posted THEN RAISE EXCEPTION 'REPLAY_ORIGINAL_BASELINE_CHANGED'; END IF;
 IF NEW.delta<>NEW.recalculated_entitlement-NEW.originally_posted-prior THEN RAISE EXCEPTION 'REPLAY_DELTA_BASELINE_MISMATCH'; END IF;
 RETURN NEW;
END $$;
