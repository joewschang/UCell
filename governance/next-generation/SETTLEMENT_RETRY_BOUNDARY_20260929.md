# Settlement transaction retry boundary — 2026-09-29

Scope: expanded autonomous queue item 3, period-close restart/concurrency evidence. This is a transaction-boundary checkpoint, not completion of a governed period-close job system.

The current Referral K0 and Binary K1 services are called directly by Admin bonus API endpoints. No dedicated period-close worker was found in the inspected API settlement modules or Worker entry point. Automatic delivery/retry governance, durable scheduling and governed period-close dispatch remain pending. The follow-ups below extend the transaction evidence, including real process termination and restart against a surviving local PostgreSQL instance.

`backend/apps/api/test/settlement-retry-db.e2e-spec.ts` initially added four real PostgreSQL cases using unique test rules and empty historical periods:

- For both Referral K0 and Binary K1, two Serializable transactions are synchronized after reading an absent batch. Exactly one finalizes; the other surfaces a uniqueness/serialization conflict (P2002/P2034). A fresh Prisma client and service instance retry returns the existing finalized batch. There remains exactly one sealed snapshot, with no duplicate finalization.
- For both engines, a fault is injected at snapshot creation after the service's batch-finalization update. The transaction rolls back both batch and snapshot. A fresh client/service successfully retries and produces one finalized batch and one verified snapshot.

These tests use the real service, database transactions, configured-calendar validation and sealing code. Instrumentation only synchronizes the existing-batch read or throws at the snapshot-create boundary. The initial empty cohort isolates transaction semantics; the nonempty follow-up below extends award coverage. Neither set certifies payouts, true OS/process crashes, or automatic conflict recovery. Successful amount-bearing writer/read cases remain covered separately by `period-eligibility-lineage-db.e2e-spec.ts`.

Initial empty-cohort validation: isolated **2 suites / 11 tests PASS**, fresh **0→107 migrations**, **162 baseline assertions**, cleanup PASS. Log: `C:/UCell/logs/settlement-retry-20260929.log`. The initial empty-cohort slice changed tests/docs only and did not repeat full API regression.

Browser acceptance was retried first. Both `cua_repl` browser initialization and the computer-use skill's `node_repl`/`@oai/sky` initialization returned `failed to write kernel assets: 系統找不到指定的路徑。 (os error 3)`. No browser or native app interaction occurred, and visual acceptance remains unverified. Stage remains NOT READY; no deployment was performed.

## Nonempty Referral/Binary follow-up

Four additional real PostgreSQL cases now run the same synchronized concurrent-delivery and sealing-failure/retry paths with two exact ORDER GPV sources of 100 each. Referral produces two awards of 15; Binary produces one award of 10, two inactive eligibility decisions, and three carry rows. Verified snapshots reconcile recipient/evidence counts. Each award has exactly two lifecycle rows, and fresh-client retries preserve complete award, lifecycle, eligibility, carry and snapshot records.

Sealing failure rolls back the finalized batch, awards, eligibility decisions and carry rows while preserving the two previously sealed GPV inputs. A fresh client then completes the same calculation once. Funded fixtures use separate bounded historical periods, plans, statuses and tree edges. All test runtime parameters, including the original empty-period cases, now expire after their historical period so they cannot enter current effective-rule resolution in other suites. These are real committed transactions in the disposable isolated database, not nested rollback simulations. They still do not certify process termination recovery, automatic conflict retries, payout concurrency or a governed job scheduler.

Focused isolated **2 suites / 15 tests PASS**, 107 migrations / 162 baseline assertions / cleanup PASS. Log: `C:/UCell/logs/settlement-funded-retry-20260929.log`. Final full isolated API regression **144 suites / 1,071 tests PASS**, with 107 migrations / 162 baseline assertions / cleanup PASS. Log: `C:/UCell/logs/settlement-funded-full-final-20260929.log`. This includes the effective-rule lookup suites that exposed the previously unbounded test parameter lifetime. Tests/docs only; no deployment or browser acceptance was performed.
## Matching and Global follow-up

Four additional committed PostgreSQL cases cover funded Matching and Global concurrency and injected sealing failure. Matching first prepares a real finalized Binary period, then verifies one Matching award of 1 referencing the exact Binary award of 10. A failed Matching attempt preserves all prerequisite Binary rows and original GPV snapshots; retry completes only the missing Matching transaction.

Global uses its current-placement capture contract with isolated test identities and historical activity/rule windows. Concurrent calls are synchronized before either sees an existing Global settlement. Its existing conflict handler allows both calls to return the same finalized result: one award 4, one Reservoir A effect 6, and one verified sealed snapshot. Injected sealing failure rolls back Global settlement/award, rank achievements and Reservoir effect together. Fresh-client retries preserve the complete economic state, including rank history, lifecycle rows, carries, qualification decisions and source snapshots where applicable.

The synchronization gate now targets the requested settlement identity only, allowing prerequisite lookups and Global's existing-conflict read to proceed normally. The test harness does not add production retry behavior. Matching still surfaces a serialization/uniqueness conflict for caller retry; Global already handles that recovery internally. These cases do not certify a process kill, automatic scheduler, payout concurrency or deployment readiness.

Focused isolated **2 suites / 19 tests PASS**, with 107 migrations / 162 baseline assertions / cleanup PASS. Log: `C:/UCell/logs/matching-global-retry-20260929.log`. Full isolated API regression **144 suites / 1,075 tests PASS**, with 107 migrations / 162 baseline assertions / cleanup PASS. Log: `C:/UCell/logs/matching-global-retry-full-20260929.log`. Tests/docs only; no deployment or browser acceptance was performed.

## Real process termination and restart

Eight additional funded cases cover Referral K0, Binary K1, Matching K2 and Global at two boundaries: inside the transaction immediately before sealed snapshot creation, and after the service's transaction commits but before the child returns completion. A dedicated Node process runs the actual services against the disposable database. The parent waits for an IPC boundary signal, force-terminates that exact child with SIGKILL (Windows forced process termination), observes its exit, and waits for its PostgreSQL backend session to disappear before checking state. This does not use an injected JavaScript exception or graceful disconnect.

Before-seal termination restores the full pre-attempt economic state, preserving GPV inputs and Matching's finalized Binary prerequisites. After-commit termination preserves exactly one finalized result with its awards, sealed evidence, carry/lifecycle rows and Global rank/Reservoir effects as applicable. A new OS process then delivers the same settlement twice; exact state comparisons prove committed rows are unchanged. Monetary expectations remain Referral 15 + 15, Binary 10, Matching 1 sourced from Binary 10, and Global 4 distributed / 6 in Reservoir A.

The helper refuses non-local or non-disposable database names and non-test rule identities. Interruption hooks remain entirely in test code. This certifies application-process failure with PostgreSQL still running; whole-machine power loss, PostgreSQL crash recovery, production infrastructure and a durable governed scheduler are outside this evidence. No production behavior or migration was changed.

Focused isolated **2 suites / 27 tests PASS**, with 107 migrations / 162 baseline assertions / cleanup PASS. Log: `C:/UCell/logs/settlement-process-recovery-20260929.log`. Full isolated API regression **144 suites / 1,083 tests PASS**, with 107 migrations / 162 baseline assertions / cleanup PASS. Log: `C:/UCell/logs/settlement-process-full-20260929.log`. Stage remains NOT READY; no deployment or browser acceptance was performed.
