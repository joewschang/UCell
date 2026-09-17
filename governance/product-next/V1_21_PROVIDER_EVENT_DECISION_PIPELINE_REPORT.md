# V1.21 Provider Event Decision Pipeline Report

Status: IMPLEMENTED — TRANSACTION-READY DOMAIN DECISION
Date: 2026-09-17
Branch: integration/member-backend-mvp

## Scope delivered

- Added one decision pipeline that composes provider-event canonicalization, sanitized hashing, duplicate classification and canonical payment transition validation.
- New canonical events return `APPLY` with the next canonical status.
- Exact hash replay returns `NOOP_REPLAY`, including after the original transition was already applied.
- Reuse of an event identity with changed canonical evidence fails with `PROVIDER_EVENT_IDENTITY_CONFLICT`.
- Evidence source must match the canonical event source.
- New provider outcome evidence is validated even when its status equals the current Payment status; unchanged status cannot bypass webhook/query/reconciliation/POS evidence requirements.
- Invalid terminal-state regression remains fail closed.

This is the deterministic decision layer for a future Serializable Payment persistence transaction. It does not claim DB concurrency or provider UAT.

## Verification

- Focused decision + transition Jest: 2 suites, 16 tests PASS.
- Backend API build: PASS.
- Isolated Backend API Jest: fresh DB, 39 migrations, 22 suites, 231 tests PASS.
- Isolated database cleanup: PASS.
- No schema, credential, provider enablement or monetary-rule change.

## Remaining gates

The designated Prisma schema owner must later persist provider identity/hash, Payment transition and outbox effect atomically with a unique constraint and real concurrent DB tests. Provider signature/checksum implementation and sandbox/UAT still require official material and credentials.

Production Promotion remains blocked.
