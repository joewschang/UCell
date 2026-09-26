# G8 Stage Migration 87 recovery execution — 2026-09-26

**Status:** `PASS` for Stage only. **Production:** untouched and not authorized.

## Controlled recovery result

The failed migration `20260926110000_g8_audit_event_core` was reconciled without rewriting existing `audit.audit_event` rows:

1. Prisma recorded only the failed migration as rolled back.
2. `migration-87-append-safe-reconciliation.sql` established the approved DDL, indexes and insert-time defaults without historical DML.
3. The Stage harness verified the schema postcondition before Prisma recorded the migration applied.
4. Prisma recorded it applied and `migrate deploy` then reported **87 migrations** and **no pending migrations**.

The execution was `ucell-stage-migrate-hayhfmf`; the normal post-recovery deploy check was `ucell-stage-migrate-080xnc3`.

## Integrity evidence

- Pre-recovery ledger: migration 87 was unfinished/not rolled back.
- Pre-recovery historical AuditEvent evidence: 287 rows; safe one-way fingerprint `062f705639b594277728454248ebda59`.
- Postcondition: 13 audit columns; expected trace/environment indexes; original and new append-only triggers present.
- New audit insert, automatic `event_code`, and `trace_id` population: PASS.
- Historical fingerprint unchanged; historical UPDATE and DELETE both rejected: PASS.
- Prisma ledger ends with the completed migration and its retained rolled-back failed-attempt record. No manual `_prisma_migrations` mutation occurred.

Azure Stage has its configured seven-day automated point-in-time recovery. Azure rejected a new on-demand backup because this Stage server uses a Burstable SKU; this is recorded as `AUTOMATED_PITR_AVAILABLE`, not as a newly created backup.

## G8 API/Worker deployment and smoke

The controlled backend/worker update then completed from source `0eeb81481b033677c338c81b6edf55de1a8fead0`:

- migration deploy: PASS, 87 migrations/no pending migration;
- API revision `ucell-stage-api--g8g80eeb814`: healthy; `/api/v1/health`: PASS;
- Worker revision `ucell-stage-worker--g8g80eeb814`: healthy;
- Admin and Member Stage UAT frontend revisions: unchanged;
- deliberate invalid Entra exchange returned 401 and recorded privacy-safe `LOGIN_FAILED` audit evidence with correlation metadata;
- authenticated Member BOLA-denied audit remains a Stage UAT exercise requiring the guarded synthetic Member flow. No token was read, exported or logged during this deployment.

Full machine-readable safe evidence: [stage-migration87-recovery-20260926.json](evidence/stage-migration87-recovery-20260926.json).
