# Financial health monitor — 2026-10-01

Authority: §35 FER-18/19. Read-only Operations views now inspect paged Payout, Payable and Recovery authorities under one Repeatable Read snapshot per request. Exact hashed business references select a single source or provide keyset cursors. Admission horizon and current data-through are distinct; healthy rows remain part of page traversal.

- Payout checks compare complete batch/line gross, recovery and net totals, actual Payable ownership/gross, recorded recovery applications, and bank evidence. SQL aggregates selected batches without serializing their complete payment histories. Bank paid values use each line's maximum cumulative PAID amount; partial and final confirmations are never added together. Latest failures remain actionable until superseded by payment evidence. Zero-net lines require an explicit confirmation.
- Bank incomplete candidates start when a batch enters the export/payment stage; draft preparation is not mislabeled as overdue bank work. A PAID batch or Payable lacking bank proof is explicitly inconsistent. Whole-batch amounts remain unallocated to award periods.
- Payable checks resolve all three source types: BonusAward, RPV upline award and GlobalPool award. Missing/unsupported sources, amount/recipient/rule/award-category contradictions, Company destinations, missing Bonus EFFECTIVE evidence, early availability and broken payout links are separate candidates. The read does not invent or repair source facts.
- Recovery checks compare required/recovered/outstanding balances with actual applications and expose outstanding work. Aggregates and counters are explicitly CURRENT_PAGE_ONLY; no whole-system or readiness claim follows from one healthy page.
- New Finance/Compliance/Super Admin UI shows evidence and candidate hashes with safe source references. A payout link opens that exact batch using its public reference, including batches outside the legacy first-page queue. Existing payout commands retain their permissions and authority. Internal source UUIDs, names, bank references, detail JSON and calculation snapshots do not appear in the new monitor payload.

## Verification

Fresh disposable PostgreSQL 0→121 and 162 baseline assertions PASS; **3 suites / 30 tests PASS**, including governed dual-approval/export→FAILED→partial→full bank flow, confirmed zero-net recovery offset, real Bonus/RPV/Global materialization, privacy, exact public-reference resolution, same-period identity separation, keyset horizon and HTTP role gates. RPV fixtures include actual subscription and monthly-recognition sources; database constraints remain enabled.

Admin production build and **6 files / 15 tests PASS** cover bounded labels, cumulative semantics, paging, exact payout deep-link routing and existing payment controls. API build, OpenAPI generation/preflight and security preflight PASS. Final typed-maturity real-DB run: **1 suite / 4 tests PASS**, 0→121 / 162 baseline assertions and cleanup PASS; final API/Admin builds PASS. No migration or deployment.

Logs: `C:\UCell\logs\cr-batch-operations-financial-final-db.log`, `cr-batch-operations-financial-maturity-db.log`, `cr-batch-operations-financial-admin-test.log` and corresponding build/OpenAPI/security logs.

Controlled financial candidate-to-task integration, broader period/recognition/Company views, detailed source drilldown, browser journeys and full recertification remain in progress. The new monitor complements period financial reconciliation; it does not replace approved export integrity checks or certify a compensation period.
