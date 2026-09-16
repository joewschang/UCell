# Subscription calendar continuation — 2026-09-16

Branch `integration/member-backend-mvp`; pre-change checkpoint `7693c08`.

Legacy UTC month construction in `SubscriptionService` is replaced by a versioned calendar snapshot. Subscription creation now requires explicit effective parameters for timezone, monthly period/anchor and recognition cutoff. Each Subscription and MonthlyRecognitionSchedule stores the same parameter snapshot hash. PostgreSQL converts the configured local cutoff to the persisted instant, so the TEST_ONLY Asia/Taipei fixture for local `2026-09-01 00:00:00` produces `2026-08-31T16:00:00.000Z`.

No Production cutoff is seeded or inferred. Missing parameters return `CONFIGURATION_PENDING` before schedule writes. The isolated Golden fixture uses a unique `TEST_ONLY_SUBSCRIPTION_CALENDAR_*` rule version and an approval reference explicitly marked `TEST_ONLY_NOT_PRODUCTION_APPROVAL`. Existing historical rows are not rewritten, and no schema migration is needed because the snapshot-hash fields already exist.

Verification in this batch:

| Gate | Result |
|---|---|
| Focused Vertical Slice 02 | PASS: 16 tests / 2 Pending Decision TODO |
| API build / Nest DI metadata | PASS: `SubscriptionCalendarService` resolved explicitly |
| Fresh isolated DB migrations | PASS: all 25 migrations from zero |
| Golden DB journey | PASS: membership 117, RPV concurrency 20, Member identity 278, Member/Admin integration 59 assertions |
| Subscription DB evidence | PASS: local cutoff instant and snapshot hash on Subscription plus all schedules |

The executable TODO inventory remains 3, all `PENDING_DECISION`: historical GPV to PV/BV conversion and the two Matching inactive-sponsor traversal cases. Production remains blocked by the unapproved operational cutoff values, formal credentials/security E2E and UAT.
