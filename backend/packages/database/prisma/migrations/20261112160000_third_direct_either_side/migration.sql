-- Keep the trigger binding installed by 0013 on both fresh and existing databases.
CREATE OR REPLACE FUNCTION organization.ucell_guard_first_third_left()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  sponsor_id uuid;
  direct_sequence integer;
BEGIN
  SELECT sponsor_qualification_id, sponsor_sequence_no
    INTO sponsor_id, direct_sequence
    FROM organization.sponsor_relationship
   WHERE child_qualification_id = NEW.child_qualification_id
     AND effective_from <= NEW.effective_from
     AND (effective_to IS NULL OR effective_to > NEW.effective_from)
   ORDER BY effective_from DESC
   LIMIT 1;

  IF direct_sequence IS DISTINCT FROM 3 OR NEW.parent_qualification_id = sponsor_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM membership.qualification
              WHERE qualification_id = sponsor_id AND kind = 'COMPANY_BOOTSTRAP') THEN
    RETURN NEW;
  END IF;

  -- Walk the candidate parent's ancestors at placement time. Either branch is valid.
  IF NOT EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT NEW.parent_qualification_id
      UNION
      SELECT edge.parent_qualification_id
        FROM ancestors
        JOIN organization.binary_placement edge ON edge.child_qualification_id = ancestors.id
       WHERE ancestors.id <> sponsor_id
         AND edge.effective_from <= NEW.effective_from
         AND (edge.effective_to IS NULL OR edge.effective_to > NEW.effective_from)
    )
    SELECT 1 FROM ancestors WHERE id = sponsor_id
  ) THEN
    RAISE EXCEPTION 'SPONSOR_SUBTREE_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
