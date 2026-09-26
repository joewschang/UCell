# G8 Stage audit migration blocker — 2026-09-26

**Candidate:** `7b8417b6d8408664c9e4f02ffad625f378f82ff4`  
**Stage baseline:** `6f5e340dc77b0188799a492aefc8cbba24a307ac` (86 migrations)  
**Failed migration:** `20260926110000_g8_audit_event_core` (migration 87)

## Observed controlled failure

The Stage migration Job used the digest-pinned candidate backend image and reached Prisma `migrate deploy`. It found 87 migrations and failed before any API or Worker revision update. PostgreSQL returned `P3018` / `P0001`: the migration's historical `UPDATE audit.audit_event` was rejected by the pre-existing `trg_audit_event_append_only` trigger.

The failure is data-dependent: a fresh empty isolated database can add the columns and has no historical audit rows to update, while Stage correctly protects existing rows from rewrite. The G8 Stage update tool restored the migration Job image to the prior digest-pinned Stage backend image. API, Worker, Admin and Member remained on their previously healthy Stage revisions.

## Boundary

This record does not modify migration 87, disable append-only protection, mark a failed migration as applied, or mutate Stage audit facts. A later migration cannot run until Prisma's failed migration state is recovered through a traceable approved path.

## Required recovery decision

An authorized migration recovery owner must choose a forward-safe path that preserves every existing audit fact and traceability. The decision must define whether historical audit rows retain default/legacy metadata without UPDATE, and the governed Prisma recovery sequence: backup/PITR reference, isolated verification, approval, and rollback evidence.

Until that decision exists, `G8_STAGE_AUDIT_DEPLOYMENT = BLOCKED`. This does not invalidate the existing Stage revision or the completed local G8 audit-core evidence.
