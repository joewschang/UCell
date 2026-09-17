-- Analytics-only derived snapshots; raw SQL queries keep Core delegates independent.
CREATE TABLE integration.management_analytics_snapshot (
  snapshot_id uuid PRIMARY KEY,
  actor_key text NOT NULL,
  scope_key text NOT NULL,
  as_of timestamptz NOT NULL,
  policy_version text NOT NULL,
  source_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX management_analytics_scope_time ON integration.management_analytics_snapshot(scope_key, as_of DESC);
CREATE INDEX management_analytics_time ON integration.management_analytics_snapshot(as_of DESC);
COMMENT ON TABLE integration.management_analytics_snapshot IS 'Derived immutable analytics; no monetary authority. Internal payload contains pseudonymous Person/Qualification IDs; never return payload directly.';
CREATE FUNCTION integration.reject_management_analytics_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'MANAGEMENT_ANALYTICS_APPEND_ONLY';
END;
$$;
CREATE TRIGGER management_analytics_append_only BEFORE UPDATE OR DELETE ON integration.management_analytics_snapshot
FOR EACH ROW EXECUTE FUNCTION integration.reject_management_analytics_mutation();
