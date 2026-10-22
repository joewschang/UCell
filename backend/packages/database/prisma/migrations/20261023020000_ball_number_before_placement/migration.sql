-- Ordinary ball identity is allocated before placement. Company identifiers still
-- require their sealed bootstrap positions. Existing identifiers remain immutable.
CREATE OR REPLACE FUNCTION membership.assert_ball_no_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_code text; v_position bigint; v_sequence bigint; v_expected text;
        v_bootstrap_count integer; v_tree uuid; v_placement_tree uuid;
BEGIN
 IF NEW.ball_no IS NULL THEN RETURN NEW; END IF;
 SELECT t.tree_code,m.binary_position_no,t.bootstrap_company_ball_count,m.binary_tree_id
 INTO v_code,v_position,v_bootstrap_count,v_placement_tree
 FROM organization.binary_tree_membership m JOIN organization.binary_tree t USING(binary_tree_id)
 WHERE m.qualification_id=NEW.qualification_id;
 IF NEW.kind='COMPANY_BOOTSTRAP' THEN
  IF v_position IS NULL OR v_position NOT BETWEEN 1 AND v_bootstrap_count THEN
   RAISE EXCEPTION 'BALL_NO_REQUIRES_BINARY_POSITION';
  END IF;
  v_expected:=v_code || 'X' || lpad(v_position::text,6,'0');
 ELSE
  SELECT t.tree_code,a.sequence_no,a.binary_tree_id INTO v_code,v_sequence,v_tree
  FROM organization.ball_no_allocation a JOIN organization.binary_tree t USING(binary_tree_id)
  WHERE a.qualification_id=NEW.qualification_id;
  IF v_sequence IS NULL THEN RAISE EXCEPTION 'BALL_ALLOCATION_REQUIRED'; END IF;
  IF v_placement_tree IS NOT NULL AND v_placement_tree<>v_tree THEN
   RAISE EXCEPTION 'BALL_ALLOCATION_TREE_MISMATCH';
  END IF;
  IF v_position IS NOT NULL AND v_position<=v_bootstrap_count THEN
   RAISE EXCEPTION 'BOOTSTRAP_POSITION_RESERVED';
  END IF;
  v_expected:=v_code || CASE WHEN length(v_sequence::text)<6 THEN lpad(v_sequence::text,6,'0') ELSE v_sequence::text END;
 END IF;
 IF NEW.ball_no<>v_expected THEN RAISE EXCEPTION 'BALL_NO_ALLOCATION_MISMATCH'; END IF;
 RETURN NEW;
END $$;
