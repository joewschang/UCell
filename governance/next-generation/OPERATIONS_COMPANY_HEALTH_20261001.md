# Company / Reservoir B operational evidence — 2026-10-01

Bounded Operations integration is verified; whole-batch closure remains in progress.

The authenticated Company monitor traverses Bonus, RPV and Global award sources with keyset pagination and a fixed creation horizon. Each page rechecks current evidence in one Repeatable Read transaction. Healthy and member-owned sources remain in traversal. Counts describe the current page only.

Historical ownership, original entitlement, original credits, signed Replay adjustments and the recorded source balance remain separate. Existing Company invariants inspect only the selected source IDs. Public responses use qualification numbers and hashed business references, excluding source UUIDs, actors, private summaries and parameter snapshots. No economic record is modified by monitoring.

Current candidates can create audited, idempotent, role-assigned tasks after exact evidence-hash revalidation. Completing a task does not repair an award or create a destination. Both exception transition APIs require clear source evidence for the new COMPANY_BONUS_AWARD, COMPANY_RPV_AWARD and COMPANY_GLOBAL_AWARD source types. Legacy ambiguous qualification-only Company references are not silently remapped.

## Verification

- Isolated PostgreSQL Company/financial regression: 2 suites / 25 tests PASS.
- Final Company/HTTP regression: 2 suites / 26 tests PASS; fresh 0→121 migrations, 162 baseline assertions and database cleanup PASS.
- Actual fixture proves missing destination → controlled task completion without ledger writes → both resolution routes blocked → original governed routing → resolution accepted. Fault fixtures roll back without disabling deferred economic guards.
- Historical ownership and Bonus/RPV/Global missing destinations are covered. Recorded original 100, Replay −20 and resulting balance 80 remain distinguishable.
- HTTP tests cover authentication, Finance/Compliance access, Order Operations denial, source validation and bounded queries.
- Admin Operations: 5 files / 7 tests PASS, including signed adjustment rendering and pagination horizon.
- API and Admin production builds, generated OpenAPI, OpenAPI preflight and security preflight PASS.

Logs: `C:\UCell\logs\cr-batch-operations-company-*.log`.

Exact historical stage-entry duration, broader period integration, full browser journeys and final isolated recertification remain open. No Stage or Production deployment occurred.
