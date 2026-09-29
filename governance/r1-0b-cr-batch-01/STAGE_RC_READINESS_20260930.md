# R1.0B-CR-BATCH-01 Stage RC readiness

**Checkpoint:** `e460a534f25cc30da4b1f04154b1216715646a77` on `integration/member-backend-mvp`  
**Scope:** Member My Growth, Learning Center, Event Center, Member 360 and Activity Timeline integration.

## Local implementation evidence

| Requirement | Status | Evidence |
|---|---|---|
| Member-safe My Growth read | PASS | `/member/my-growth`; server-derived qualification, Active, achieved Global Rank, organization, recognition, learning and event dimensions; no opaque score. |
| Learning Center | PASS | Versioned course/lesson, published visibility, enrollment, required-lesson completion, member views, audit and idempotency. |
| Event Center | PASS | ONLINE/OFFLINE/HYBRID event versions, capacity-safe registration, cancellation, opaque hashed check-in credential, idempotent check-in, member and governed admin reads. |
| Member 360 / Activity Timeline | PASS | Learning and event evidence projection uses business references and excludes internal identifiers. |
| Member frontend | PASS | My Growth, Learning Center and Event Center are connected to member APIs; writes generate idempotency keys and do not retain check-in credentials. |
| API source / contract | PASS | API build and generated `backend/openapi.generated.json` updated. |

## Verification run

| Check | Result |
|---|---|
| `pnpm --filter @ucell/api build` | PASS |
| `pnpm --dir member build` | PASS |
| `pnpm --dir member test` | PASS: 31 files, 175 tests |
| `pnpm --dir backend test:api:isolated` | PASS: 159 suites, 1,177 tests; fresh migrations through `20260929150000_event_foundation`; 162 baseline DB assertions; cleanup PASS |
| `pnpm --dir backend migration:preflight` | PASS |
| `node --test deployment/stage-golden-journey.test.mjs` | PASS: 3 tests; includes secret-redacted missing-credential block behavior |
| `node deployment/stage-preflight.mjs` | PASS: 25 static deployment assertions |

The isolated API run emitted the pre-existing non-fatal AnalyticsRefreshWorker warning. It did not fail a test or leave test data behind.

## Stage RC approval prerequisites

The source is ready for Stage RC review. Promotion remains intentionally blocked until the following external evidence exists:

1. Formal Stage LINE/LIFF and Entra/RBAC credentials plus interactive identity evidence.
2. Stage environment database and approved guarded seed/journey access.
3. Stage Golden Journey and formal UAT execution/sign-off.
4. Backup/restore drill and governed release evidence required by the production readiness matrix.

The current local Stage Golden Journey preflight was executed without environment values. It returned `BLOCKED` before any network request because the Stage environment, allowlist, UAT seed bearer, and owner/outsider LINE ID tokens are absent. This is the expected fail-closed result and does not substitute for Stage execution.

No Production deployment, credential change, Stage deployment, or release approval was performed by this checkpoint.
