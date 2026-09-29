# Settlement transaction retry boundary — 2026-09-29

Scope: expanded autonomous queue item 3, period-close restart/concurrency evidence. This is a transaction-boundary checkpoint, not completion of a governed period-close job system.

The current Referral K0 and Binary K1 services are called directly by Admin bonus API endpoints. No dedicated period-close worker was found in the inspected API settlement modules or Worker entry point. Automatic delivery/retry governance, durable scheduling, process-kill recovery and Matching/Global concurrent economic cohorts remain pending.

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