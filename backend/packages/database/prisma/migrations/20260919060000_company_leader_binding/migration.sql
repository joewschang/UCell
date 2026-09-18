-- Approved profile evidence; financial writers remain guarded until destination integration.
CREATE TABLE membership.company_bootstrap_profile_binding (
 binding_id uuid PRIMARY KEY,qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 binary_tree_id uuid NOT NULL REFERENCES organization.binary_tree(binary_tree_id),company_position integer NOT NULL,
 profile_version text NOT NULL,plan_code text NOT NULL,rule_version text NOT NULL,parameter_version text NOT NULL,
 snapshot_hash text NOT NULL,effective_at timestamptz(6) NOT NULL,effective_from timestamptz(6) NOT NULL,effective_to timestamptz(6),
 parameter_snapshot jsonb NOT NULL,approval_reference text NOT NULL,recorded_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE(qualification_id,snapshot_hash),
 CHECK(company_position BETWEEN 1 AND 3 AND profile_version='COMPANY_BOOTSTRAP_PROFILE_V1' AND plan_code='LEADER'),
 CHECK(length(snapshot_hash)=64 AND length(parameter_version)=64),
 CHECK(effective_at>=effective_from AND (effective_to IS NULL OR effective_at<effective_to)),
 FOREIGN KEY(binary_tree_id,company_position) REFERENCES organization.tree_canonical_position(binary_tree_id,position_no));
CREATE INDEX company_profile_effective_idx ON membership.company_bootstrap_profile_binding(qualification_id,effective_at);
CREATE FUNCTION membership.ucell_guard_profile_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'COMPANY_PROFILE_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM membership.qualification q JOIN organization.tree_canonical_position p ON p.occupant_qualification_id=q.qualification_id
  WHERE q.qualification_id=NEW.qualification_id AND q.kind='COMPANY_BOOTSTRAP' AND p.binary_tree_id=NEW.binary_tree_id AND p.position_no=NEW.company_position)
 OR NEW.parameter_snapshot->>'hash' IS DISTINCT FROM NEW.snapshot_hash OR NEW.parameter_snapshot->>'ruleVersionCode' IS DISTINCT FROM NEW.rule_version
 THEN RAISE EXCEPTION 'COMPANY_PROFILE_EVIDENCE_MISMATCH' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER company_profile_immutable BEFORE INSERT OR UPDATE OR DELETE ON membership.company_bootstrap_profile_binding FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_profile_binding();
