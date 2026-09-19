-- P0 business identifiers and authoritative binary-heap position.
-- Legacy Persons have no reliable business-allocation month. The approved, auditable
-- backfill policy allocates them in this migration's governed cutover month (2609),
-- ordered by recorded_at/person_id; it never claims that this was their enrollment date.

CREATE TABLE identity.member_no_month_counter (
  month_code char(4) PRIMARY KEY CHECK (month_code ~ '^[0-9]{4}$'),
  last_sequence integer NOT NULL CHECK (last_sequence >= 0 AND last_sequence < 1000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION identity.allocate_member_no()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_month char(4);
  v_sequence integer;
BEGIN
  v_month := to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYMM');
  INSERT INTO identity.member_no_month_counter(month_code,last_sequence)
  VALUES(v_month,1)
  ON CONFLICT(month_code) DO UPDATE
    SET last_sequence=identity.member_no_month_counter.last_sequence+1,
        updated_at=now()
  RETURNING last_sequence INTO v_sequence;
  IF v_sequence > 999999 THEN
    RAISE EXCEPTION 'MEMBER_NO_MONTH_SEQUENCE_EXHAUSTED';
  END IF;
  RETURN v_month || lpad(v_sequence::text,6,'0');
END $$;

ALTER TABLE identity.person ADD COLUMN member_no text;
WITH ordered AS (
  SELECT person_id, row_number() OVER (ORDER BY created_at, person_id) AS sequence_no
  FROM identity.person
), assigned AS (
  SELECT person_id, '2609' || lpad(sequence_no::text,6,'0') AS member_no
  FROM ordered
)
UPDATE identity.person p SET member_no=a.member_no FROM assigned a WHERE a.person_id=p.person_id;
INSERT INTO identity.member_no_month_counter(month_code,last_sequence)
SELECT '2609',coalesce(max((substring(member_no from 5))::integer),0) FROM identity.person
ON CONFLICT(month_code) DO UPDATE SET last_sequence=greatest(identity.member_no_month_counter.last_sequence,excluded.last_sequence),updated_at=now();
ALTER TABLE identity.person ALTER COLUMN member_no SET DEFAULT identity.allocate_member_no();
ALTER TABLE identity.person ALTER COLUMN member_no SET NOT NULL;
ALTER TABLE identity.person ADD CONSTRAINT person_member_no_key UNIQUE(member_no);
CREATE OR REPLACE FUNCTION identity.prevent_member_no_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.member_no IS DISTINCT FROM OLD.member_no THEN RAISE EXCEPTION 'MEMBER_NO_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER person_member_no_immutable BEFORE UPDATE ON identity.person FOR EACH ROW EXECUTE FUNCTION identity.prevent_member_no_mutation();

ALTER TABLE membership.qualification ADD COLUMN ball_no text;
ALTER TABLE organization.binary_tree_membership ADD COLUMN binary_position_no bigint;
ALTER TABLE organization.placement_tree_evidence ADD COLUMN binary_position_no bigint;

-- Bootstrap rows are otherwise permanently locked.  The one forward-only
-- cutover write from NULL to the derived Ball Number is allowed; every later
-- bootstrap mutation remains rejected by the same authoritative guard.
CREATE OR REPLACE FUNCTION membership.ucell_guard_bootstrap_qualification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.kind='COMPANY_BOOTSTRAP' THEN RAISE EXCEPTION 'BOOTSTRAP_QUALIFICATION_LOCKED' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.kind<>OLD.kind THEN RAISE EXCEPTION 'BOOTSTRAP_QUALIFICATION_LOCKED' USING ERRCODE='23514'; END IF;
 IF OLD.kind='COMPANY_BOOTSTRAP' AND NOT (OLD.ball_no IS NULL AND NEW.ball_no IS NOT NULL
   AND (to_jsonb(NEW)-'updated_at'-'ball_no')=(to_jsonb(OLD)-'updated_at'-'ball_no')) THEN
  RAISE EXCEPTION 'BOOTSTRAP_QUALIFICATION_LOCKED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

-- Existing canonical positions are direct, auditable authoritative assignments.
UPDATE organization.binary_tree_membership m
SET binary_position_no=p.position_no
FROM organization.tree_canonical_position p
WHERE p.binary_tree_id=m.binary_tree_id AND p.occupant_qualification_id=m.qualification_id;
UPDATE organization.placement_tree_evidence e
SET binary_position_no=m.binary_position_no
FROM organization.binary_tree_membership m
WHERE m.placement_tree_evidence_id=e.placement_tree_evidence_id;

-- Any already-effective non-canonical placement is reconstructed only from its
-- immutable parent placement edge. The recursive CTE is deterministic and fails
-- the migration if an old graph cannot establish a unique position.
WITH RECURSIVE paths AS (
  SELECT m.binary_tree_id,m.qualification_id,m.binary_position_no
  FROM organization.binary_tree_membership m WHERE m.binary_position_no IS NOT NULL
  UNION ALL
  SELECT child.binary_tree_id,child.qualification_id,
    paths.binary_position_no*2 + CASE e.side WHEN 'RIGHT' THEN 1 ELSE 0 END
  FROM paths
  JOIN organization.placement_tree_evidence e ON e.binary_tree_id=paths.binary_tree_id
  JOIN organization.binary_tree_membership child ON child.qualification_id=e.qualification_id
  WHERE e.parent_qualification_id=paths.qualification_id AND e.binary_position_no IS NULL
), unique_paths AS (
 SELECT binary_tree_id,qualification_id,min(binary_position_no) position_no,max(binary_position_no) max_position_no
 FROM paths GROUP BY binary_tree_id,qualification_id
)
UPDATE organization.binary_tree_membership m SET binary_position_no=u.position_no
FROM unique_paths u
WHERE m.binary_tree_id=u.binary_tree_id AND m.qualification_id=u.qualification_id
  AND u.position_no=u.max_position_no;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM organization.binary_tree_membership WHERE binary_position_no IS NULL) THEN
   RAISE EXCEPTION 'BINARY_POSITION_BACKFILL_INCOMPLETE';
 END IF;
 IF EXISTS(SELECT 1 FROM organization.binary_tree_membership WHERE binary_position_no<=0) THEN
   RAISE EXCEPTION 'BINARY_POSITION_INVALID';
 END IF;
END $$;

UPDATE organization.placement_tree_evidence e
SET binary_position_no=m.binary_position_no
FROM organization.binary_tree_membership m
WHERE m.placement_tree_evidence_id=e.placement_tree_evidence_id AND e.binary_position_no IS NULL;
ALTER TABLE organization.binary_tree_membership ALTER COLUMN binary_position_no SET NOT NULL;
ALTER TABLE organization.placement_tree_evidence ALTER COLUMN binary_position_no SET NOT NULL;
ALTER TABLE organization.binary_tree_membership ADD CONSTRAINT binary_tree_membership_position_unique UNIQUE(binary_tree_id,binary_position_no);

UPDATE membership.qualification q
SET ball_no=CASE
  WHEN m.binary_position_no<=3 THEN t.tree_code || 'X' || lpad(m.binary_position_no::text,6,'0')
  ELSE t.tree_code || lpad((m.binary_position_no-3)::text,6,'0')
END
FROM organization.binary_tree_membership m JOIN organization.binary_tree t ON t.binary_tree_id=m.binary_tree_id
WHERE q.qualification_id=m.qualification_id;
ALTER TABLE membership.qualification ADD CONSTRAINT qualification_ball_no_key UNIQUE(ball_no);

CREATE OR REPLACE FUNCTION organization.prevent_binary_position_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.binary_tree_id IS DISTINCT FROM OLD.binary_tree_id OR NEW.binary_position_no IS DISTINCT FROM OLD.binary_position_no THEN
   RAISE EXCEPTION 'BINARY_POSITION_IMMUTABLE';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER binary_tree_membership_position_immutable BEFORE UPDATE ON organization.binary_tree_membership FOR EACH ROW EXECUTE FUNCTION organization.prevent_binary_position_mutation();

CREATE OR REPLACE FUNCTION organization.prevent_placement_evidence_position_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.binary_tree_id IS DISTINCT FROM OLD.binary_tree_id OR NEW.binary_position_no IS DISTINCT FROM OLD.binary_position_no
    OR NEW.parent_qualification_id IS DISTINCT FROM OLD.parent_qualification_id OR NEW.side IS DISTINCT FROM OLD.side THEN
   RAISE EXCEPTION 'PLACEMENT_POSITION_EVIDENCE_IMMUTABLE';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER placement_tree_evidence_position_immutable BEFORE UPDATE ON organization.placement_tree_evidence FOR EACH ROW EXECUTE FUNCTION organization.prevent_placement_evidence_position_mutation();

CREATE OR REPLACE FUNCTION membership.prevent_ball_no_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.ball_no IS NOT NULL AND NEW.ball_no IS DISTINCT FROM OLD.ball_no THEN RAISE EXCEPTION 'BALL_NO_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qualification_ball_no_immutable BEFORE UPDATE ON membership.qualification FOR EACH ROW EXECUTE FUNCTION membership.prevent_ball_no_mutation();

CREATE OR REPLACE FUNCTION membership.assert_ball_no_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_tree_code text; v_position bigint; v_expected text;
BEGIN
 IF NEW.ball_no IS NULL THEN RETURN NEW; END IF;
 SELECT t.tree_code,m.binary_position_no INTO v_tree_code,v_position
 FROM organization.binary_tree_membership m JOIN organization.binary_tree t ON t.binary_tree_id=m.binary_tree_id
 WHERE m.qualification_id=NEW.qualification_id;
 IF v_tree_code IS NULL OR v_position IS NULL THEN RAISE EXCEPTION 'BALL_NO_REQUIRES_BINARY_POSITION'; END IF;
 v_expected:=CASE WHEN v_position<=3 THEN v_tree_code || 'X' || lpad(v_position::text,6,'0')
                  ELSE v_tree_code || lpad((v_position-3)::text,6,'0') END;
 IF NEW.ball_no<>v_expected THEN RAISE EXCEPTION 'BALL_NO_POSITION_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qualification_ball_no_integrity BEFORE INSERT OR UPDATE OF ball_no ON membership.qualification FOR EACH ROW EXECUTE FUNCTION membership.assert_ball_no_integrity();

CREATE OR REPLACE FUNCTION organization.assert_placement_position_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_parent bigint;
BEGIN
 SELECT binary_position_no INTO v_parent FROM organization.binary_tree_membership WHERE qualification_id=NEW.parent_qualification_id;
 IF NEW.parent_qualification_id IS NULL THEN
   IF NEW.binary_position_no<>1 THEN RAISE EXCEPTION 'BINARY_POSITION_ROOT_MISMATCH'; END IF;
 ELSIF v_parent IS NULL OR NEW.side IS NULL OR NEW.binary_position_no <> v_parent*2 + (CASE NEW.side WHEN 'RIGHT' THEN 1 ELSE 0 END) THEN
   RAISE EXCEPTION 'BINARY_POSITION_PARENT_SIDE_MISMATCH';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER placement_tree_evidence_position_integrity BEFORE INSERT ON organization.placement_tree_evidence FOR EACH ROW EXECUTE FUNCTION organization.assert_placement_position_integrity();
