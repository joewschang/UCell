# Period-close Worker process recovery evidence

Follow-up to PERIOD_CLOSE_DISPATCH_20260929.md. Tests and evidence only; no production code, migration, feature enablement or deployment changed.

Eight real PostgreSQL cases exercise Referral K0, Binary K1, Matching K2 and Global through a separate Node process using the production WorkerLoop, period-close poller, lease core and shared settlement executor. The parent waits for an explicit boundary signal, force-terminates that exact process, observes exit, and waits for its PostgreSQL session to disappear before inspecting state. These are process termination cases, not thrown exceptions or graceful shutdown.

At the before-seal boundary the leased transaction has performed settlement work but has not sealed its result. Termination rolls back settlement/snapshot/receipt/economic state and preserves Matching's already-finalized Binary prerequisite. The durable Outbox claim remains PROCESSING with one attempt. A fresh Worker process cannot take over while that lease is still valid. The test then advances only that job's lease deadline in its disposable database to simulate expiration instead of waiting the production two-minute lease; a new process claims attempt two and atomically completes the sealed result, immutable receipt and Outbox acknowledgement.

At the after-commit boundary the poller's transaction and acknowledgement have committed, but the child has not reported completion. Termination leaves one completed receipt and a PROCESSED Outbox with one attempt. Repeated new Worker processes preserve the full stored settlement/snapshot/receipt/carry/Reservoir state and the entire Outbox row. Sealed envelope kind, source and rule match the receipt and immutable request.

The initial eight cases use empty historical cohorts to isolate durable delivery and dependency behavior. The funded follow-up below extends the same process-termination path to amount-bearing jobs. Neither set certifies whole-machine power loss, PostgreSQL crash recovery, elapsed two-minute timing, process interruption of non-settlement Worker duties, calendar planning, late-input freezing or deployment readiness.

The suite requires the local isolated test runner, creates a separately named disposable database for the conservative global-input barrier, deploys the current migration history, and drops it after testing. The child refuses other database names/hosts and non-test rule identities. No existing workspace data is cleared to make the readiness barrier pass.

Validation: **1 suite / 8 tests PASS**, fresh **0→109 migrations**, **162 baseline assertions**, isolated runner and suite database cleanup PASS. Log: `C:/UCell/logs/period-close-worker-crash-20260929.log`. Full API regression was not repeated for this test-only slice. Stage remains NOT READY; no browser acceptance or deployment was performed.

## Funded Worker recovery follow-up

Eight additional cases run the same Worker process termination, unexpired-lease exclusion, simulated expiry and repeated new-process delivery with two sealed ORDER GPV inputs of 100 each. Fixtures use separate historical periods and bounded plan/status/activity/sponsor history. Global follows its existing current-placement capture contract with unique fixture identities.

Completed receipts reconcile Referral awards 15 + 15, Binary award 10, Matching award 1 with its exact Binary source award of 10, and Global award 4 / Reservoir A effect 6. Every target BonusAward has two lifecycle events. Both sealed GPV sources survive recovery. State comparisons now include qualification decisions, award lifecycle events, Global awards and Global rank history in addition to settlement/carry/receipt/Reservoir records, so pre-commit rollback and post-commit replay checks cover the entire recorded economic result. Matching's prior Binary completion remains intact.

This remains a test-only change using the actual WorkerLoop, poller and shared executor. The suite cleanup hook allows 30 seconds for dropping its disposable database and always closes the management connection. Its original five-second deadline was exceeded once after all 16 test cases passed; no database was left behind, and the final rerun completed successfully.

Combined empty/funded validation: **1 suite / 16 tests PASS**, fresh **0→109 migrations**, **162 baseline assertions**, both disposable database cleanups PASS. Log: `C:/UCell/logs/period-close-worker-funded-crash-final-20260929.log`. Full API regression was not repeated for this test-only follow-up. No production behavior, feature enablement or deployment changed.
