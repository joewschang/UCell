-- The public Ball identifier contract permits a one-character Tree code (for
-- example Tree A -> AX000001 / A000001). Keep the database constraint aligned
-- with the application identifier validator.
ALTER TABLE organization.binary_tree DROP CONSTRAINT IF EXISTS tree_names_valid;
ALTER TABLE organization.binary_tree
  ADD CONSTRAINT tree_names_valid
  CHECK (
    length(btrim(tree_name)) BETWEEN 1 AND 120
    AND tree_code ~ '^[A-Z][A-Z0-9_-]{0,39}$'
    AND topology_version > 0
  );
