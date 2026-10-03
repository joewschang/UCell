# Migration 87 approved schema/runtime postcondition

**Migration:** `20260926110000_g8_audit_event_core`  
**Scope:** `audit.audit_event` operational metadata only.

## A. Schema / DDL

The table has these additional columns with the schema definitions declared by migration 87: `event_code`, `environment`, `trace_id`, `actor_role_snapshot`, `result`, `changed_field_names`, `before_hash`, `after_hash`, `evidence_ref`, `severity`, `privacy_class`, `retention_class`, and `created_at`. Their types, nullability and defaults must match a fresh 0→87 installation.

## B. Functions and triggers

`audit.ucell_audit_event_before_insert` is installed and the `trg_audit_event_before_insert` trigger ensures every new row has a non-empty `event_code`, a `trace_id` derived from `correlation_id` where absent, and a `created_at` value.

`audit.ucell_audit_event_prevent_mutation`, `trg_audit_event_no_update`, and `trg_audit_event_no_delete` are installed in addition to the original `trg_audit_event_append_only`. Audit UPDATE and DELETE remain rejected.

## C. Indexes / defaults

`ix_audit_event_trace_occurred` and `ix_audit_event_environment_code_occurred` exist. The defaults and catalog definitions equal a fresh 0→87 installation.

## D. Historical DML

The migration's historical `UPDATE audit.audit_event` is **not** a required postcondition for a populated pre-87 database. It is prohibited by the pre-existing append-only rule. Existing rows retain all original authoritative fields unchanged. They may have legacy/null G8 metadata; readers must use their original `occurred_at`, `action`, and `correlation_id` semantics for those rows.

## E. Required runtime behavior

New `AuditEvent` inserts through the current Prisma/API runtime succeed and receive `event_code` and `trace_id`. The runtime cannot update or delete historical or new audit rows. The recovered schema catalog is equivalent to a fresh 0→87 catalog.
