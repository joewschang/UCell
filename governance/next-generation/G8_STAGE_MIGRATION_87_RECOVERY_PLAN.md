# G8 Stage migration 87 recovery plan

**Status:** `PASS` — executed on Stage on 2026-09-26 under explicit approval. See [G8_STAGE_MIGRATION_87_RECOVERY_EXECUTION_20260926.md](G8_STAGE_MIGRATION_87_RECOVERY_EXECUTION_20260926.md).  
**Production:** out of scope and untouched.

## Local proof

`pnpm g8:migration87:recovery-golden` passed against disposable local PostgreSQL. It proves:

1. pre-87 history causes the exact migration 87 failure;
2. Prisma `migrate resolve --rolled-back` records the failed attempt as rolled back without business/audit data mutation;
3. the append-safe reconciliation SQL creates the approved postcondition without historical DML;
4. Prisma `migrate resolve --applied` records the independently verified postcondition using the migration 87 checksum;
5. subsequent `migrate deploy` passes;
6. recovered catalog equals fresh 0→87, old authoritative audit fields remain unchanged, new audit inserts work, and audit UPDATE/DELETE remain blocked.

## Stage prerequisites

- Explicit change approval, named DB/recovery operator, and maintenance window.
- Current Stage backup/PITR reference and a successfully verified isolated restore copy.
- The exact candidate source/image identity and migration 87 checksum recorded.
- A second operator reviews the before/after counts, ledger state, and append-only checks.
- No API/Worker traffic update until the DB procedure passes.

## Approved-command sequence for an isolated restored copy

Inject the restored copy's `DATABASE_URL` into the process environment only. Do not place it on a command line, in Git, or in an evidence file.

```powershell
pnpm --filter @ucell/database exec prisma migrate resolve --rolled-back 20260926110000_g8_audit_event_core --schema packages/database/prisma/schema.prisma
pnpm --filter @ucell/database exec prisma db execute --file packages/database/prisma/recovery/migration-87-append-safe-reconciliation.sql --schema packages/database/prisma/schema.prisma
pnpm --filter @ucell/database exec prisma migrate resolve --applied 20260926110000_g8_audit_event_core --schema packages/database/prisma/schema.prisma
pnpm db:deploy
```

Before and after the sequence, record only safe evidence: migration ledger status/count, audit row count, integrity hashes of original authoritative audit fields, catalog comparison result, new-insert result, and rejected UPDATE/DELETE result. Do not record audit payloads, secrets, or database URLs.

## Historical Stage execution gate

Run the same sequence only after the isolated restored-copy drill passes for the exact Stage backup reference. If any check fails, stop before application deployment, retain the old Stage image/job configuration, and restore the isolated copy only. The existing Stage revision is the rollback target; no audit rows are to be edited, deleted, or recreated.

