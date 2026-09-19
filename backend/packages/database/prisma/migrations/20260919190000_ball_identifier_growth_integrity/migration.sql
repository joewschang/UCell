-- PostgreSQL lpad(text, 6, '0') truncates values longer than six characters.
-- Ball identifiers use a minimum width of six and must grow naturally after
-- 999999, matching the authoritative bigint-safe application helper.
CREATE OR REPLACE FUNCTION membership.assert_ball_no_integrity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_tree_code text; v_position bigint; v_ordinal text; v_expected text;
BEGIN
 IF NEW.ball_no IS NULL THEN RETURN NEW; END IF;
 SELECT t.tree_code,m.binary_position_no INTO v_tree_code,v_position
 FROM organization.binary_tree_membership m JOIN organization.binary_tree t ON t.binary_tree_id=m.binary_tree_id
 WHERE m.qualification_id=NEW.qualification_id;
 IF v_tree_code IS NULL OR v_position IS NULL THEN RAISE EXCEPTION 'BALL_NO_REQUIRES_BINARY_POSITION'; END IF;
 v_ordinal:=CASE WHEN v_position<=3 THEN v_position::text ELSE (v_position-3)::text END;
 v_expected:=v_tree_code
   || CASE WHEN v_position<=3 THEN 'X' ELSE '' END
   || CASE WHEN length(v_ordinal)<6 THEN lpad(v_ordinal,6,'0') ELSE v_ordinal END;
 IF NEW.ball_no<>v_expected THEN RAISE EXCEPTION 'BALL_NO_POSITION_MISMATCH'; END IF;
 RETURN NEW;
END $$;

