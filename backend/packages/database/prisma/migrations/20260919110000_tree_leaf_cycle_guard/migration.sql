-- Keep the original cycle rule. A new leaf cannot close a path when tree writes
-- share the existing tree lock. Legacy/non-tree and non-leaf edges retain the
-- complete ancestor traversal. This is not a company or placement-rule bypass.
CREATE OR REPLACE FUNCTION organization.ucell_guard_binary_cycle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE has_cycle boolean; tree_id uuid;
BEGIN
 IF NEW.parent_qualification_id=NEW.child_qualification_id THEN RAISE EXCEPTION 'Binary cycle detected'; END IF;
 SELECT p.binary_tree_id INTO tree_id FROM organization.binary_tree_membership p
 JOIN organization.binary_tree_membership c ON c.binary_tree_id=p.binary_tree_id
 WHERE p.qualification_id=NEW.parent_qualification_id AND c.qualification_id=NEW.child_qualification_id;
 IF tree_id IS NOT NULL THEN
  PERFORM 1 FROM organization.binary_tree WHERE binary_tree_id=tree_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM organization.binary_placement WHERE parent_qualification_id=NEW.child_qualification_id AND effective_to IS NULL) THEN RETURN NEW; END IF;
 END IF;
 WITH RECURSIVE ancestors AS (
  SELECT parent_qualification_id FROM organization.binary_placement
  WHERE child_qualification_id=NEW.parent_qualification_id AND effective_to IS NULL
  UNION ALL
  SELECT bp.parent_qualification_id FROM organization.binary_placement bp JOIN ancestors a ON bp.child_qualification_id=a.parent_qualification_id WHERE bp.effective_to IS NULL
 )
 SELECT EXISTS(SELECT 1 FROM ancestors WHERE parent_qualification_id=NEW.child_qualification_id) INTO has_cycle;
 IF has_cycle THEN RAISE EXCEPTION 'Binary cycle detected'; END IF;
 RETURN NEW;
END $$;
