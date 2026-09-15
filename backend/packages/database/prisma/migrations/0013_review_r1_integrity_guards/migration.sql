-- UCell R1.0B REVIEW R1
-- Database-level guardrails required by the frozen organization rules.

CREATE OR REPLACE FUNCTION organization.ucell_is_in_left_subtree(
  p_sponsor uuid,
  p_candidate_parent uuid,
  p_at timestamptz
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE left_root AS (
    SELECT child_qualification_id AS qualification_id
    FROM organization.binary_placement
    WHERE parent_qualification_id=p_sponsor
      AND side='LEFT'::organization."SideCode"
      AND effective_from <= p_at
      AND (effective_to IS NULL OR effective_to > p_at)
    LIMIT 1
  ),
  subtree AS (
    SELECT qualification_id FROM left_root
    UNION ALL
    SELECT bp.child_qualification_id
    FROM organization.binary_placement bp
    JOIN subtree s ON bp.parent_qualification_id=s.qualification_id
    WHERE bp.effective_from <= p_at
      AND (bp.effective_to IS NULL OR bp.effective_to > p_at)
  )
  SELECT EXISTS(SELECT 1 FROM subtree WHERE qualification_id=p_candidate_parent);
$$;

CREATE OR REPLACE FUNCTION organization.ucell_guard_first_third_left()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_sponsor uuid;
  v_seq integer;
  v_ok boolean;
BEGIN
  SELECT sponsor_qualification_id,sponsor_sequence_no
  INTO v_sponsor,v_seq
  FROM organization.sponsor_relationship
  WHERE child_qualification_id=NEW.child_qualification_id
    AND effective_from <= NEW.effective_from
    AND (effective_to IS NULL OR effective_to > NEW.effective_from)
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_sponsor IS NULL OR v_seq NOT IN (1,3) THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_qualification_id=v_sponsor AND NEW.side='LEFT'::organization."SideCode" THEN
    RETURN NEW;
  END IF;

  v_ok:=organization.ucell_is_in_left_subtree(
    v_sponsor,NEW.parent_qualification_id,NEW.effective_from
  );

  IF NOT COALESCE(v_ok,false) THEN
    RAISE EXCEPTION 'BINARY_LEFT_SUBTREE_REQUIRED: sponsor sequence % must be in left subtree',v_seq
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_binary_first_third_left ON organization.binary_placement;
CREATE TRIGGER trg_binary_first_third_left
BEFORE INSERT ON organization.binary_placement
FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_first_third_left();

CREATE OR REPLACE FUNCTION organization.ucell_guard_current_sponsor_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.effective_to IS NULL AND
     (NEW.sponsor_qualification_id IS DISTINCT FROM OLD.sponsor_qualification_id
      OR NEW.sponsor_sequence_no IS DISTINCT FROM OLD.sponsor_sequence_no) THEN
    RAISE EXCEPTION 'Current Sponsor/sequence is immutable; use a supervised supersede flow'
      USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sponsor_update_guard ON organization.sponsor_relationship;
CREATE TRIGGER trg_sponsor_update_guard
BEFORE UPDATE ON organization.sponsor_relationship
FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_current_sponsor_update();
