# Settlement transaction retry boundary — 2026-09-29

Scope: expanded autonomous queue item 3, period-close restart/concurrency evidence. This is a transaction-boundary checkpoint, not completion of a governed period-close job system.

The current Referral K0 and Binary K1 services are called directly by Admin bonus API endpoints. No dedicated period-close worker was found in the inspected API settlement modules or Worker entry point. Automatic delivery/retry governance, durable scheduling, process-kill recovery and nonempty concurrent economic cohorts remain pending.

`backend/apps/api/test/settlement-retry-db.e2e-spec.ts` adds four real PostgreSQL cases using unique test rules and empty historical periods:

- For both Referral K0 and Binary K1, two Serializable transactions are synchronized after reading an absent batch. Exactly one finalizes; the other surfaces a uniqueness/serialization conflict (P2002/P2034). A fresh Prisma client and service instance retry returns the existing finalized batch. There remains exactly one sealed snapshot, with no duplicate finalization.
- For both engines, a fault is injected at snapshot creation after the service's batch-finalization update. The transaction rolls back both batch and snapshot. A fresh client/service successfully retries and produces one finalized batch and one verified snapshot.

These tests use the real service, database transactions, configured-calendar validation and sealing code. Instrumentation only synchronizes the existing-batch read or throws at the snapshot-create boundary. The empty cohort isolates transaction semantics; it does not certify concurrent nonzero awards, payouts, true OS/process crashes, or automatic conflict recovery. Successful amount-bearing writer/read cases remain covered separately by `period-eligibility-lineage-db.e2e-spec.ts`.

Validation: isolated **2 suites / 11 tests PASS**, fresh **0→107 migrations**, **162 baseline assertions**, cleanup PASS. Log: `C:/UCell/logs/settlement-retry-20260929.log`. Tests/docs only; full API regression was not repeated for this slice.

Browser acceptance was retried first. Both `cua_repl` browser initialization and the computer-use skill's `node_repl`/`@oai/sky` initialization returned `failed to write kernel assets: 系統找不到指定的路徑。 (os error 3)`. No browser or native app interaction occurred, and visual acceptance remains unverified. Stage remains NOT READY; no deployment was performed.
