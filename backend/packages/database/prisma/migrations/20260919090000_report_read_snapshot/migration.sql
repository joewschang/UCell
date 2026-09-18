CREATE TABLE ledger.report_read_snapshot(
 snapshot_id uuid PRIMARY KEY,actor_id uuid NOT NULL,role text NOT NULL,query jsonb NOT NULL,database_snapshot text NOT NULL,
 captured_at timestamptz(6) NOT NULL DEFAULT now(),expires_at timestamptz(6) NOT NULL,CHECK(expires_at>captured_at));
CREATE INDEX report_read_snapshot_expiry_idx ON ledger.report_read_snapshot(expires_at);
CREATE TRIGGER report_read_snapshot_immutable BEFORE UPDATE ON ledger.report_read_snapshot FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
ALTER TABLE ledger.reservoir_b_effect ADD COLUMN recorded_transaction bigint NOT NULL DEFAULT txid_current();
ALTER TABLE ledger.reservoir_ledger_effect ADD COLUMN recorded_transaction bigint NOT NULL DEFAULT txid_current();
