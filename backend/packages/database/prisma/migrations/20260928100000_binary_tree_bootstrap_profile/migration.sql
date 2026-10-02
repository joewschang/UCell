-- R1.0B-CR-BATCH-01: versioned, immutable Binary Tree bootstrap profile.
-- Existing trees retain their actual historical three-Company-Ball structure via
-- the non-selectable LEGACY_THREE_COMPANY_BALLS profile. New Trees select only
-- an approved published profile; the standard profile materializes seven Company Balls.
CREATE TABLE organization.binary_tree_bootstrap_profile (
  bootstrap_profile_id uuid PRIMARY KEY,
  profile_code text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL,
  company_ball_count integer NOT NULL CHECK (company_ball_count > 0),
  company_plan_code text NOT NULL,
  company_active_policy text NOT NULL,
  company_award_policy text NOT NULL,
  economic_destination text NOT NULL,
  effective_from timestamptz(6) NOT NULL,
  effective_to timestamptz(6),
  approval_reference text NOT NULL,
  snapshot_hash char(64) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE(profile_code, version)
);
CREATE INDEX binary_tree_bootstrap_profile_effective_idx ON organization.binary_tree_bootstrap_profile(status, effective_from, effective_to);

INSERT INTO organization.binary_tree_bootstrap_profile (
  bootstrap_profile_id, profile_code, version, status, company_ball_count,
  company_plan_code, company_active_policy, company_award_policy, economic_destination,
  effective_from, approval_reference, snapshot_hash
) VALUES
  ('00000000-0000-4000-8000-000000000087', 'LEGACY_THREE_COMPANY_BALLS', 1, 'HISTORICAL', 3,
   'LEADER', 'ALWAYS_ACTIVE', 'APPLICABLE_AWARDS', 'RESERVOIR_B',
   '1970-01-01T00:00:00Z', 'R1.0B-CR-BATCH-01 legacy structural snapshot', repeat('0',64)),
  ('00000000-0000-4000-8000-000000000088', 'STANDARD_LEADER_72000_7', 1, 'PUBLISHED', 7,
   'LEADER', 'ALWAYS_ACTIVE', 'APPLICABLE_AWARDS', 'RESERVOIR_B',
   '2026-09-28T00:00:00Z', 'R1.0B-CR-BATCH-01 / section 29 DC-9', repeat('1',64));

ALTER TABLE organization.binary_tree
  ADD COLUMN bootstrap_profile_id uuid,
  ADD COLUMN bootstrap_profile_code text,
  ADD COLUMN bootstrap_company_ball_count integer,
  ADD COLUMN bootstrap_profile_snapshot jsonb;

UPDATE organization.binary_tree
SET bootstrap_profile_id = '00000000-0000-4000-8000-000000000087',
    bootstrap_profile_code = 'LEGACY_THREE_COMPANY_BALLS',
    bootstrap_profile_version = 1,
    bootstrap_company_ball_count = 3,
    bootstrap_profile_snapshot = jsonb_build_object(
      'profileCode','LEGACY_THREE_COMPANY_BALLS','version',1,'companyBallCount',3,
      'companyPlanCode','LEADER','companyActivePolicy','ALWAYS_ACTIVE',
      'companyAwardPolicy','APPLICABLE_AWARDS','economicDestination','RESERVOIR_B',
      'approvalReference','R1.0B-CR-BATCH-01 legacy structural snapshot'
    )
WHERE bootstrap_profile_id IS NULL;

ALTER TABLE organization.binary_tree
  ALTER COLUMN bootstrap_profile_id SET NOT NULL,
  ALTER COLUMN bootstrap_profile_code SET NOT NULL,
  ALTER COLUMN bootstrap_company_ball_count SET NOT NULL,
  ALTER COLUMN bootstrap_profile_snapshot SET NOT NULL,
  ADD CONSTRAINT binary_tree_bootstrap_profile_fk FOREIGN KEY (bootstrap_profile_id)
    REFERENCES organization.binary_tree_bootstrap_profile(bootstrap_profile_id),
  ADD CONSTRAINT binary_tree_bootstrap_company_ball_count_check CHECK (bootstrap_company_ball_count > 0);
CREATE INDEX binary_tree_bootstrap_profile_idx ON organization.binary_tree(bootstrap_profile_id);

-- Replace the pre-CR non-monetary freeze with a profile-aware compatibility gate.
ALTER TABLE organization.binary_tree DROP CONSTRAINT tree_nonmonetary_gate;
ALTER TABLE organization.binary_tree ADD CONSTRAINT tree_bootstrap_profile_gate CHECK (
  economic_activation IN ('PENDING_MAPPING','APPROVED_LEADER_BINDING')
  AND bootstrap_profile_code <> ''
  AND bootstrap_company_ball_count > 0
);
-- CR Batch 01 profiles make the bootstrap span explicit. The identifier guard
-- remains authoritative: only immutable profile-owned bootstrap positions use X IDs.
CREATE OR REPLACE FUNCTION membership.assert_ball_no_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_code text; v_position bigint; v_sequence bigint; v_expected text; v_bootstrap_count integer;
BEGIN
 IF NEW.ball_no IS NULL THEN RETURN NEW; END IF;
 SELECT t.tree_code,m.binary_position_no,t.bootstrap_company_ball_count
   INTO v_code,v_position,v_bootstrap_count
 FROM organization.binary_tree_membership m JOIN organization.binary_tree t USING(binary_tree_id)
 WHERE m.qualification_id=NEW.qualification_id;
 IF v_code IS NULL OR v_position IS NULL THEN RAISE EXCEPTION 'BALL_NO_REQUIRES_BINARY_POSITION'; END IF;
 IF NEW.kind='COMPANY_BOOTSTRAP' AND v_position BETWEEN 1 AND v_bootstrap_count THEN
  v_expected:=v_code || 'X' || lpad(v_position::text,6,'0');
 ELSE
  IF v_position<=v_bootstrap_count THEN RAISE EXCEPTION 'BOOTSTRAP_POSITION_RESERVED'; END IF;
  SELECT a.sequence_no INTO v_sequence FROM organization.ball_no_allocation a
  JOIN organization.binary_tree_membership m USING(qualification_id,binary_tree_id)
  WHERE a.qualification_id=NEW.qualification_id;
  IF v_sequence IS NULL THEN RAISE EXCEPTION 'BALL_ALLOCATION_REQUIRED'; END IF;
  v_expected:=v_code || CASE WHEN length(v_sequence::text)<6 THEN lpad(v_sequence::text,6,'0') ELSE v_sequence::text END;
 END IF;
 IF NEW.ball_no<>v_expected THEN RAISE EXCEPTION 'BALL_NO_ALLOCATION_MISMATCH'; END IF;
 RETURN NEW;
END $$;

-- The original canonical constraint enumerated only positions 1..7. Preserve
-- those rows and extend the same parent/side invariant for profile-derived trees.
ALTER TABLE organization.tree_canonical_position DROP CONSTRAINT canonical_topology;
ALTER TABLE organization.tree_canonical_position ADD CONSTRAINT canonical_topology CHECK (
  (position_no=1 AND parent_position_no IS NULL AND side IS NULL) OR
  (position_no>1 AND parent_position_no=position_no/2 AND side=CASE WHEN position_no % 2=0 THEN 'LEFT'::organization."SideCode" ELSE 'RIGHT'::organization."SideCode" END)
);

-- Company LEADER parameter bindings remain the existing R1 registry snapshot;
-- their legal positional span is now determined by the immutable Tree profile.
ALTER TABLE membership.company_bootstrap_profile_binding DROP CONSTRAINT company_bootstrap_profile_binding_check;
ALTER TABLE membership.company_bootstrap_profile_binding ADD CONSTRAINT company_bootstrap_profile_binding_check CHECK (
  company_position >= 1
  AND profile_version='COMPANY_BOOTSTRAP_PROFILE_V1'
  AND plan_code='LEADER'
);

-- Bootstrap completeness is profile-derived. This replaces only the old fixed
-- three-Ball verifier; historic trees retain count=3 in their immutable snapshot.
CREATE OR REPLACE FUNCTION organization.ucell_verify_tree_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_count integer; v_position integer; v_root uuid; v_child uuid; v_parent uuid; v_side organization."SideCode";
BEGIN
 SELECT bootstrap_company_ball_count INTO v_count FROM organization.binary_tree WHERE binary_tree_id=NEW.binary_tree_id;
 SELECT occupant_qualification_id INTO v_root FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=1;
 IF v_count IS NULL
  OR (SELECT count(*) FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id)<>v_count*2+1
  OR (SELECT count(*) FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND occupant_qualification_id IS NOT NULL)<>v_count
  OR (SELECT count(*) FROM organization.binary_tree_membership WHERE binary_tree_id=NEW.binary_tree_id)<>v_count
  OR (SELECT count(*) FROM membership.qualification q JOIN organization.binary_tree_membership m USING(qualification_id) WHERE m.binary_tree_id=NEW.binary_tree_id AND q.kind='COMPANY_BOOTSTRAP' AND q.current_company_principal_id=NEW.company_principal_id AND q.plan_level_code IS NULL)<>v_count
  OR NOT EXISTS(SELECT 1 FROM organization.company_sponsor_designation WHERE binary_tree_id=NEW.binary_tree_id AND qualification_id=v_root)
  OR EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE child_qualification_id=v_root)
  OR EXISTS(SELECT 1 FROM organization.binary_placement WHERE child_qualification_id=v_root)
 THEN RAISE EXCEPTION 'TREE_BOOTSTRAP_INCOMPLETE' USING ERRCODE='23514'; END IF;
 FOR v_position IN 2..v_count LOOP
   SELECT occupant_qualification_id INTO v_child FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=v_position;
   SELECT occupant_qualification_id INTO v_parent FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=v_position/2;
   v_side:=CASE WHEN v_position % 2=0 THEN 'LEFT'::organization."SideCode" ELSE 'RIGHT'::organization."SideCode" END;
   IF v_child IS NULL OR v_parent IS NULL
      OR NOT EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE sponsor_qualification_id=v_root AND child_qualification_id=v_child AND sponsor_sequence_no=v_position-1)
      OR NOT EXISTS(SELECT 1 FROM organization.binary_placement WHERE parent_qualification_id=v_parent AND child_qualification_id=v_child AND side=v_side)
   THEN RAISE EXCEPTION 'TREE_BOOTSTRAP_INCOMPLETE' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NULL;
END $$;

-- Keep placement immutability while deriving legal Company bootstrap edges from
-- the Tree's immutable profile rather than the historical 1..3 constant.
CREATE OR REPLACE FUNCTION organization.ucell_guard_tree_placement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p organization.binary_tree_membership; c organization.binary_tree_membership; t organization.binary_tree; k membership."QualificationKind";
BEGIN
 SELECT * INTO p FROM organization.binary_tree_membership WHERE qualification_id=NEW.parent_qualification_id;
 SELECT * INTO c FROM organization.binary_tree_membership WHERE qualification_id=NEW.child_qualification_id;
 IF p.qualification_id IS NULL AND c.qualification_id IS NULL THEN RETURN NEW; END IF;
 IF p.qualification_id IS NULL OR c.qualification_id IS NULL OR p.binary_tree_id<>c.binary_tree_id THEN RAISE EXCEPTION 'BINARY_TREE_SCOPE_MISMATCH' USING ERRCODE='23514'; END IF;
 SELECT * INTO t FROM organization.binary_tree WHERE binary_tree_id=p.binary_tree_id FOR UPDATE;
 SELECT kind INTO k FROM membership.qualification WHERE qualification_id=NEW.child_qualification_id;
 IF p.effective_from>NEW.effective_from OR c.effective_from<>NEW.effective_from OR EXISTS(SELECT 1 FROM organization.binary_placement WHERE child_qualification_id=NEW.child_qualification_id) THEN RAISE EXCEPTION 'TREE_PLACEMENT_HISTORICAL_CONFLICT' USING ERRCODE='23514'; END IF;
 IF k='COMPANY_BOOTSTRAP' THEN
  IF t.status<>'DRAFT' OR NOT EXISTS(
    SELECT 1 FROM organization.tree_canonical_position child JOIN organization.tree_canonical_position parent ON parent.binary_tree_id=child.binary_tree_id AND parent.position_no=child.parent_position_no
    WHERE child.binary_tree_id=t.binary_tree_id AND child.position_no BETWEEN 2 AND t.bootstrap_company_ball_count
      AND child.occupant_qualification_id=NEW.child_qualification_id AND parent.occupant_qualification_id=NEW.parent_qualification_id AND child.side=NEW.side
  ) THEN RAISE EXCEPTION 'BOOTSTRAP_PLACEMENT_LOCKED' USING ERRCODE='23514'; END IF;
 ELSIF t.status<>'ACTIVE' THEN RAISE EXCEPTION 'TREE_NOT_OPEN_TO_PLACEMENT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

-- Founding evidence begins after the profile-owned Company span, not at the
-- former hard-coded position four. Historic three-Ball trees remain unchanged.
ALTER TABLE organization.founding_occupation_evidence DROP CONSTRAINT founding_position_range;
ALTER TABLE organization.founding_occupation_evidence ADD CONSTRAINT founding_position_range CHECK (position_no >= 4 AND actual_sponsor_sequence_no>=3 AND length(evidence_hash)=64);
CREATE OR REPLACE FUNCTION organization.ucell_verify_canonical_occupation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE slot organization.tree_canonical_position; fact organization.founding_occupation_evidence; parent_id uuid; v_bootstrap_count integer;
BEGIN
 SELECT * INTO slot FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=NEW.position_no;
 SELECT bootstrap_company_ball_count INTO v_bootstrap_count FROM organization.binary_tree WHERE binary_tree_id=NEW.binary_tree_id;
 IF TG_TABLE_NAME='founding_occupation_evidence' THEN
  IF slot.occupant_qualification_id IS DISTINCT FROM NEW.qualification_id THEN RAISE EXCEPTION 'FOUNDING_OCCUPATION_EVIDENCE_MISMATCH' USING ERRCODE='23514'; END IF;
 END IF;
 IF slot.occupant_qualification_id IS NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM organization.binary_tree_membership m WHERE m.qualification_id=slot.occupant_qualification_id AND m.binary_tree_id=slot.binary_tree_id) THEN RAISE EXCEPTION 'CANONICAL_OCCUPANT_TREE_MISMATCH' USING ERRCODE='23514'; END IF;
 IF slot.position_no>v_bootstrap_count THEN
  SELECT * INTO fact FROM organization.founding_occupation_evidence WHERE binary_tree_id=slot.binary_tree_id AND position_no=slot.position_no AND qualification_id=slot.occupant_qualification_id;
  SELECT occupant_qualification_id INTO parent_id FROM organization.tree_canonical_position WHERE binary_tree_id=slot.binary_tree_id AND position_no=slot.parent_position_no;
  IF fact.qualification_id IS NULL OR fact.effective_at<>slot.occupied_at
   OR NOT EXISTS(SELECT 1 FROM membership.qualification q WHERE q.qualification_id=fact.qualification_id AND q.kind='MEMBER_ORIGIN')
   OR NOT EXISTS(SELECT 1 FROM organization.company_sponsor_designation d WHERE d.binary_tree_id=fact.binary_tree_id AND d.qualification_id=fact.company_sponsor_qualification_id)
   OR NOT EXISTS(SELECT 1 FROM organization.sponsor_relationship s WHERE s.sponsor_relationship_id=fact.sponsor_relationship_id AND s.child_qualification_id=fact.qualification_id AND s.sponsor_qualification_id=fact.company_sponsor_qualification_id AND s.sponsor_sequence_no=fact.actual_sponsor_sequence_no AND s.effective_from<=fact.effective_at AND (s.effective_to IS NULL OR s.effective_to>fact.effective_at))
   OR NOT EXISTS(SELECT 1 FROM organization.binary_placement b WHERE b.child_qualification_id=fact.qualification_id AND b.parent_qualification_id=parent_id AND b.side=slot.side AND b.effective_from=fact.effective_at)
   OR NOT EXISTS(SELECT 1 FROM membership.qualification_owner_interval o WHERE o.qualification_id=fact.qualification_id AND o.owner_type='MEMBER' AND o.person_id=fact.initial_person_id AND o.effective_from<=fact.effective_at AND (o.effective_to IS NULL OR o.effective_to>fact.effective_at)) THEN
   RAISE EXCEPTION 'FOUNDING_OCCUPATION_EVIDENCE_MISMATCH' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NULL;
END $$;

-- Only Company positions #2/#3 remain root sponsor chronology records. The
-- added #4–#7 Company Balls are topology-only; they cannot consume Member
-- first/third sponsor sequencing.
CREATE OR REPLACE FUNCTION organization.ucell_verify_tree_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_count integer; v_position integer; v_root uuid; v_child uuid; v_parent uuid; v_side organization."SideCode";
BEGIN
 SELECT bootstrap_company_ball_count INTO v_count FROM organization.binary_tree WHERE binary_tree_id=NEW.binary_tree_id;
 SELECT occupant_qualification_id INTO v_root FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=1;
 IF v_count IS NULL
  OR (SELECT count(*) FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id)<>v_count*2+1
  OR (SELECT count(*) FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND occupant_qualification_id IS NOT NULL)<>v_count
  OR (SELECT count(*) FROM organization.binary_tree_membership WHERE binary_tree_id=NEW.binary_tree_id)<>v_count
  OR (SELECT count(*) FROM membership.qualification q JOIN organization.binary_tree_membership m USING(qualification_id) WHERE m.binary_tree_id=NEW.binary_tree_id AND q.kind='COMPANY_BOOTSTRAP' AND q.current_company_principal_id=NEW.company_principal_id AND q.plan_level_code IS NULL)<>v_count
  OR NOT EXISTS(SELECT 1 FROM organization.company_sponsor_designation WHERE binary_tree_id=NEW.binary_tree_id AND qualification_id=v_root)
  OR EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE child_qualification_id=v_root)
  OR EXISTS(SELECT 1 FROM organization.binary_placement WHERE child_qualification_id=v_root)
 THEN RAISE EXCEPTION 'TREE_BOOTSTRAP_INCOMPLETE' USING ERRCODE='23514'; END IF;
 FOR v_position IN 2..v_count LOOP
   SELECT occupant_qualification_id INTO v_child FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=v_position;
   SELECT occupant_qualification_id INTO v_parent FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=v_position/2;
   v_side:=CASE WHEN v_position % 2=0 THEN 'LEFT'::organization."SideCode" ELSE 'RIGHT'::organization."SideCode" END;
   IF v_child IS NULL OR v_parent IS NULL
      OR NOT EXISTS(SELECT 1 FROM organization.binary_placement WHERE parent_qualification_id=v_parent AND child_qualification_id=v_child AND side=v_side)
      OR (v_position IN (2,3) AND NOT EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE sponsor_qualification_id=v_root AND child_qualification_id=v_child AND sponsor_sequence_no=v_position-1))
      OR (v_position>3 AND EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE child_qualification_id=v_child))
   THEN RAISE EXCEPTION 'TREE_BOOTSTRAP_INCOMPLETE' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
