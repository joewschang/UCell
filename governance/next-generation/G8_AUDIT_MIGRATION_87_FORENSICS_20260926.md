# G8 migration 87 forensic result — 2026-09-26

## Exact rejected SQL

Migration `20260926110000_g8_audit_event_core` is rejected at:

```sql
UPDATE audit.audit_event
SET event_code = action,
    trace_id = correlation_id::text,
    created_at = COALESCE(created_at, occurred_at)
WHERE event_code = '' OR trace_id IS NULL;
```

The migration intended to populate new G8 query metadata for rows that existed before the new columns and insert trigger. The original migration `0001_vertical_slice` already defined `trg_audit_event_append_only BEFORE UPDATE OR DELETE ON audit.audit_event`, which invokes `public.ucell_prevent_mutation()` and rejects every historical row update.

## Classification

**B — prohibited mutation of historical append-only audit evidence**, expressed as a **D — Stage data/state-specific conflict**. The migration succeeds from fresh 0→current only because there are no pre-existing audit rows to update. It fails correctly against a populated pre-87 database. This is not a trigger failure, and it is not safe to disable the trigger globally or rewrite the existing audit history.

## Local disposable PostgreSQL evidence

`backend/scripts/g8-audit-migration-forensics.mjs` completed with:

| Scenario | Result |
|---|---|
| Pre-87 local database | 86 successfully applied migrations; one immutable historical audit row inserted |
| Pre-87 → migration 87 | Expected failure observed: exit `1`, exact append-only rejection, and `event_code` column absent after the failed transaction |
| Fresh 0→current | 87 migrations PASS |
| New audit insert | insert trigger populated `event_code` and `trace_id` |
| Audit integrity | attempted UPDATE remained blocked by append-only trigger |
| Cleanup | both disposable databases and temporary migration workspace removed |

## Forward-safe recovery assessment

The safe schema semantics for historical rows are: preserve their immutable original columns and use defaults/legacy interpretation where G8 metadata was not recorded; new audit inserts populate G8 metadata through the new insert trigger. That avoids history rewrite.

However, Prisma cannot reach a later forward migration while migration 87 is marked failed, and this repository must not silently edit migration 87 or mark it applied without a governed recovery record. Therefore a new migration 88 alone cannot safely resolve the Stage state.

The required approved recovery procedure must explicitly authorize and reproduce all of the following in an isolated Stage-like restore before any Stage action:

1. apply only the append-safe schema portion of migration 87, excluding the historical `UPDATE`;
2. verify every historical audit row remains byte-for-byte unchanged in its original authoritative columns and that append-only triggers remain enabled;
3. record the controlled Prisma failed-migration resolution and applied-state evidence; and
4. apply any subsequent forward compatibility migration, then run audit integrity and application smoke verification.

Until a migration-recovery authority approves that exceptional Prisma state-reconciliation procedure, `STAGE_RECOVERY_READY_FOR_APPROVAL = NO`. No Stage database recovery command is authorized by this document.
