-- Persist transaction visibility so late commits cannot enter subsequent pages.
ALTER TABLE organization.binary_tree_membership ADD COLUMN recorded_transaction bigint NOT NULL DEFAULT txid_current();
ALTER TABLE membership.qualification_owner_interval ADD COLUMN recorded_transaction bigint NOT NULL DEFAULT txid_current();
ALTER TABLE membership.qualification_owner_interval ADD COLUMN closed_transaction bigint DEFAULT txid_current();
ALTER TABLE membership.qualification_owner_interval ALTER COLUMN closed_transaction DROP DEFAULT;
CREATE TABLE organization.tree_read_snapshot (
 snapshot_token uuid PRIMARY KEY,binary_tree_id uuid NOT NULL REFERENCES organization.company_sponsor_designation(binary_tree_id),
 actor_id uuid NOT NULL,role text NOT NULL,time jsonb NOT NULL,database_snapshot text NOT NULL,
 captured_at timestamptz(6) NOT NULL DEFAULT now(),expires_at timestamptz(6) NOT NULL,CHECK(expires_at>captured_at));
CREATE INDEX tree_read_snapshot_expires_at_idx ON organization.tree_read_snapshot(expires_at);
CREATE INDEX tree_membership_cursor_idx ON organization.binary_tree_membership(binary_tree_id,qualification_id);
CREATE OR REPLACE FUNCTION membership.ucell_guard_owner_interval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'OWNER_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM membership.qualification WHERE qualification_id=OLD.qualification_id AND kind='COMPANY_BOOTSTRAP')
 OR (to_jsonb(NEW)-'effective_to'-'closed_recorded_at'-'closed_transaction')<>(to_jsonb(OLD)-'effective_to'-'closed_recorded_at'-'closed_transaction')
 OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.closed_recorded_at IS NULL THEN
 RAISE EXCEPTION 'OWNER_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
 NEW.closed_transaction:=txid_current(); RETURN NEW;
END $$;
CREATE FUNCTION organization.ucell_guard_tree_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'TREE_READ_SNAPSHOT_IMMUTABLE' USING ERRCODE='23514'; END $$;
CREATE TRIGGER tree_read_snapshot_immutable BEFORE UPDATE ON organization.tree_read_snapshot FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_tree_snapshot();
