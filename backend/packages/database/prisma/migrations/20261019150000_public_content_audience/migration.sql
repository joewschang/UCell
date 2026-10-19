-- Existing content remains member-only. Public visibility requires a new,
-- explicitly approved version; published snapshots remain immutable.
ALTER TABLE integration.content_version DROP CONSTRAINT content_version_audience_policy_check;
ALTER TABLE integration.content_version ADD CONSTRAINT content_version_audience_policy_check
  CHECK (audience_policy IN ('NETWORK_MEMBER', 'PUBLIC'));
