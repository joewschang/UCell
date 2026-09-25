-- Ball identity V2: preserve all published identifiers; new ordinary Balls use
-- a transactionally allocated per-tree sequence independent of binary topology.
BEGIN;
-- Hold writers until backfill and the replacement integrity check are committed.
LOCK TABLE organization.binary_tree, membership.qualification IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE organization.ball_no_counter (
 binary_tree_id uuid PRIMARY KEY REFERENCES organization.binary_tree(binary_tree_id) ON DELETE RESTRICT,
 last_sequence bigint NOT NULL CHECK (last_sequence >= 0)
);
CREATE TABLE organization.ball_no_allocation (
 qualification_id uuid PRIMARY KEY REFERENCES membership.qualification(qualification_id) ON DELETE RESTRICT,
 binary_tree_id uuid NOT NULL REFERENCES organization.binary_tree(binary_tree_id) ON DELETE RESTRICT,
 sequence_no bigint NOT NULL CHECK (sequence_no > 0),
 rule_version text NOT NULL CHECK (rule_version IN ('LEGACY_POSITION_V1','TREE_SEQUENCE_V2')),
 allocated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(binary_tree_id,sequence_no)
);

-- Derive the exact suffix using the full tree-code length, never a guessed prefix.
-- Do not rewrite any old Ball number, historical event, or financial snapshot.
INSERT INTO organization.ball_no_allocation(qualification_id,binary_tree_id,sequence_no,rule_version)
SELECT q.qualification_id,m.binary_tree_id,substring(q.ball_no FROM length(t.tree_code)+1)::bigint,'LEGACY_POSITION_V1'
FROM membership.qualification q
JOIN organization.binary_tree_membership m USING(qualification_id)
JOIN organization.binary_tree t USING(binary_tree_id)
WHERE m.binary_position_no>3 AND q.ball_no IS NOT NULL;
INSERT INTO organization.ball_no_counter(binary_tree_id,last_sequence)
SELECT t.binary_tree_id,coalesce(max(a.sequence_no),0)
FROM organization.binary_tree t LEFT JOIN organization.ball_no_allocation a USING(binary_tree_id)
GROUP BY t.binary_tree_id;

CREATE FUNCTION organization.allocate_ball_no(p_tree uuid,p_qualification uuid) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v_code text; v_sequence bigint; v_existing organization.ball_no_allocation%ROWTYPE;
BEGIN
 -- Same lock ordering as placement; serializes allocation and protects retries.
 SELECT tree_code INTO STRICT v_code FROM organization.binary_tree WHERE binary_tree_id=p_tree FOR UPDATE;
 PERFORM 1 FROM membership.qualification WHERE qualification_id=p_qualification AND kind<>'COMPANY_BOOTSTRAP' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDINARY_BALL_QUALIFICATION_REQUIRED'; END IF;
 SELECT * INTO v_existing FROM organization.ball_no_allocation WHERE qualification_id=p_qualification;
 IF FOUND THEN
  IF v_existing.binary_tree_id<>p_tree THEN RAISE EXCEPTION 'BALL_ALLOCATION_TREE_MISMATCH'; END IF;
  v_sequence:=v_existing.sequence_no;
 ELSE
  INSERT INTO organization.ball_no_counter(binary_tree_id,last_sequence) VALUES(p_tree,1)
  ON CONFLICT(binary_tree_id) DO UPDATE SET last_sequence=organization.ball_no_counter.last_sequence+1
  RETURNING last_sequence INTO v_sequence;
  INSERT INTO organization.ball_no_allocation(qualification_id,binary_tree_id,sequence_no,rule_version)
  VALUES(p_qualification,p_tree,v_sequence,'TREE_SEQUENCE_V2');
 END IF;
 RETURN v_code || CASE WHEN length(v_sequence::text)<6 THEN lpad(v_sequence::text,6,'0') ELSE v_sequence::text END;
END $$;

CREATE FUNCTION organization.prevent_ball_allocation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'BALL_ALLOCATION_IMMUTABLE'; END $$;
CREATE TRIGGER ball_allocation_immutable BEFORE UPDATE OR DELETE ON organization.ball_no_allocation
FOR EACH ROW EXECUTE FUNCTION organization.prevent_ball_allocation_mutation();

CREATE OR REPLACE FUNCTION membership.assert_ball_no_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_code text; v_position bigint; v_sequence bigint; v_expected text;
BEGIN
 IF NEW.ball_no IS NULL THEN RETURN NEW; END IF;
 SELECT t.tree_code,m.binary_position_no INTO v_code,v_position
 FROM organization.binary_tree_membership m JOIN organization.binary_tree t USING(binary_tree_id)
 WHERE m.qualification_id=NEW.qualification_id;
 IF v_code IS NULL OR v_position IS NULL THEN RAISE EXCEPTION 'BALL_NO_REQUIRES_BINARY_POSITION'; END IF;
 IF NEW.kind='COMPANY_BOOTSTRAP' AND v_position BETWEEN 1 AND 3 THEN
  v_expected:=v_code || 'X' || lpad(v_position::text,6,'0');
 ELSE
  IF v_position<=3 THEN RAISE EXCEPTION 'BOOTSTRAP_POSITION_RESERVED'; END IF;
  SELECT a.sequence_no INTO v_sequence FROM organization.ball_no_allocation a
  JOIN organization.binary_tree_membership m USING(qualification_id,binary_tree_id)
  WHERE a.qualification_id=NEW.qualification_id;
  IF v_sequence IS NULL THEN RAISE EXCEPTION 'BALL_ALLOCATION_REQUIRED'; END IF;
  v_expected:=v_code || CASE WHEN length(v_sequence::text)<6 THEN lpad(v_sequence::text,6,'0') ELSE v_sequence::text END;
 END IF;
 IF NEW.ball_no<>v_expected THEN RAISE EXCEPTION 'BALL_NO_ALLOCATION_MISMATCH'; END IF;
 RETURN NEW;
END $$;

COMMIT;
