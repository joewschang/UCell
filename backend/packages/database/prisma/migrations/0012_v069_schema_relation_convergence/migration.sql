-- UCell R1.0B FROZEN / Backend v0.6.9
-- Relation/index convergence before first dependency-backed Prisma validation.

CREATE INDEX IF NOT EXISTS ix_auth_session_person_provider
ON identity.auth_session(person_id,provider,status,expires_at);

COMMENT ON COLUMN audit.audit_event.entity_id IS
'Optional domain entity UUID. HTTP request audit rows keep this NULL and use request_id/correlation_id for request tracing.';
