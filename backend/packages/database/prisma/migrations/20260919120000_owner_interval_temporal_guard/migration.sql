-- Migration 54 already has owner_interval_no_overlap. Verify it rather than
-- building a second identical GiST exclusion index for every owner interval.
-- This guard remains useful for ensuring fresh/recovery schemas keep that invariant.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='membership.qualification_owner_interval'::regclass
   AND conname='owner_interval_no_overlap' AND contype='x' AND convalidated
 ) THEN
  RAISE EXCEPTION 'OWNER_INTERVAL_EXCLUSION_REQUIRED';
 END IF;
END $$;
