-- Preserve historical rows; enforce new writes without inferring bank results.
CREATE TRIGGER payout_payment_result_append_only BEFORE UPDATE OR DELETE ON ledger.payout_payment_result
 FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER payout_approval_append_only BEFORE UPDATE ON ledger.payout_approval
 FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

CREATE FUNCTION ledger.ucell_validate_payment_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line_net numeric; prior_paid numeric; settled boolean;
BEGIN
 PERFORM payout_batch_id FROM ledger.payout_batch WHERE payout_batch_id=NEW.payout_batch_id FOR UPDATE;
 SELECT net_amount INTO line_net FROM ledger.payout_line
  WHERE payout_line_id=NEW.payout_line_id AND payout_batch_id=NEW.payout_batch_id;
 IF line_net IS NULL OR NEW.paid_amount>line_net OR (NEW.result_status='FAILED' AND NEW.paid_amount<>0)
 THEN RAISE EXCEPTION 'PAYOUT_RESULT_SOURCE_OR_AMOUNT_INVALID'; END IF;
 SELECT max(paid_amount),bool_or(paid_amount=line_net) INTO prior_paid,settled
  FROM ledger.payout_payment_result WHERE payout_line_id=NEW.payout_line_id AND result_status='PAID';
 IF prior_paid>NEW.paid_amount OR (settled AND NEW.result_status='FAILED')
 THEN RAISE EXCEPTION 'PAYOUT_PAID_AMOUNT_CANNOT_DECREASE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payout_payment_result_source BEFORE INSERT ON ledger.payout_payment_result
 FOR EACH ROW EXECUTE FUNCTION ledger.ucell_validate_payment_result();

CREATE FUNCTION ledger.ucell_payout_has_locked_evidence(batch_id uuid) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS(SELECT 1 FROM ledger.payout_approval WHERE payout_batch_id=batch_id AND decision='APPROVED')
  OR EXISTS(SELECT 1 FROM ledger.payout_export_artifact WHERE payout_batch_id=batch_id)
  OR EXISTS(SELECT 1 FROM ledger.payout_payment_result WHERE payout_batch_id=batch_id);
$$;
CREATE FUNCTION ledger.ucell_protect_payout_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_batch uuid; new_batch uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN old_batch:=OLD.payout_batch_id; END IF;
 IF TG_OP<>'DELETE' THEN new_batch:=NEW.payout_batch_id; END IF;
 PERFORM payout_batch_id FROM ledger.payout_batch WHERE payout_batch_id IN (old_batch,new_batch) ORDER BY payout_batch_id FOR UPDATE;
 IF ledger.ucell_payout_has_locked_evidence(old_batch) OR ledger.ucell_payout_has_locked_evidence(new_batch)
 THEN RAISE EXCEPTION 'PAYOUT_APPROVED_LINES_IMMUTABLE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payout_line_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON ledger.payout_line
 FOR EACH ROW EXECUTE FUNCTION ledger.ucell_protect_payout_line();
CREATE FUNCTION ledger.ucell_protect_payout_totals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ledger.ucell_payout_has_locked_evidence(OLD.payout_batch_id)
 AND (NEW.period_start,NEW.period_end,NEW.total_gross,NEW.total_recovery,NEW.total_net)
 IS DISTINCT FROM (OLD.period_start,OLD.period_end,OLD.total_gross,OLD.total_recovery,OLD.total_net)
 THEN RAISE EXCEPTION 'PAYOUT_APPROVED_TOTALS_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payout_batch_snapshot_guard BEFORE UPDATE ON ledger.payout_batch
 FOR EACH ROW EXECUTE FUNCTION ledger.ucell_protect_payout_totals();
