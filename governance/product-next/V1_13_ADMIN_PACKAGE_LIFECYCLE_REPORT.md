# V1.13 Admin Package Lifecycle Report

Date: 2026-09-17
Branch: `integration/member-backend-mvp`

## Delivered

- Connected explicit package scheduling for approved versions.
- Requires ISO 8601 timestamps with `Z` or an explicit numeric timezone offset.
- Provides no default effective, sales, expiry, cutoff, or Production calendar value.
- Restricts UI activation to `SCHEDULED` versions; Backend still verifies that the effective time has arrived.
- Added confirmed retirement for scheduled or active versions.
- All schedule, activation, and retirement writes use the persisted idempotent Backend command and refresh authoritative Core read-back after success.

## Verification

- Admin production build: PASS.
- Admin Vitest: 11 files, 31 tests PASS.
- Tests verify blank initial scheduling values, timezone-required input, exact non-inferred schedule payload, scheduled-only activation, and explicit retirement.

## Governance boundary

This UI does not approve a Production weekly/monthly cutoff or operational calendar. Those values remain pending formal approval. Backend state transitions, audit evidence, actor authorization, effective-time validation, and idempotency remain authoritative.
