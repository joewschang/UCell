# Phase 3 Binary / Referral TODO burn-down — 2026-09-16

Branch: integration/member-backend-mvp. Pre-change checkpoint: 40ec4f9. This batch converts exactly 17 original executable placeholders; it adds no skip and retains both unresolved Bonus Engine cases.

## Converted cases and evidence

| Original case | Actual service assertions |
|---|---|
| Binary subtree GPV rather than Sponsor tree | Archived multi-level Binary path determines root side even when its descendant edge is RIGHT; Sponsor-only 9000 volume is excluded from both sides |
| Pair=min(available left, available right), capped | Left-weak, right-weak, incoming carry, cap binding and empty-side scenarios |
| Pair deducted from both sides, strong-side carry retained | Independently expected carry for each strong side and cap-bound period; previous carry object unchanged |
| STARTER/ELITE/LEADER caps 450k/900k/1.5m | Actual paired PV, persisted cap, recipient plan snapshot and theory for each plan |
| Binary theory=paired PV×12% | Decimal fractional-volume case: 1234.56 paired yields 148.1472 |
| Binary pool=36%, K1<=1 | Unconstrained, constrained by incoming carry and zero-current-volume pools; actual batch and award amounts/K1 |
| Active G1 STARTER 15% | Actual Referral row for 1000 source GPV: 150 theory, original source identity and plan/Active snapshot |
| Active G1 ELITE 20% | Actual Referral row: 200 theory |
| Active G1 LEADER 25% | Actual Referral row: 250 theory |
| Inactive G1 generates no referral/equalization base | Active higher generations still produce no award/lifecycle writes; total theory zero |
| Equalization base is same-source G1 theory | Different G1 plans and two simultaneous sources independently preserve bases 150/500 and theories 15/50; original source identities retained |
| STARTER G2–G4 10/10/10 | Actual generation, recipient, plan and theory rows |
| ELITE G2–G6 20/10/10/5/5 | Actual generation, recipient, plan and theory rows |
| LEADER G2–G7 20/15/10/10/10/5 | Actual generation, recipient, plan and theory rows, including G5=10% |
| Intermediate ineligible generation does not block higher | Inactive or locked G2 omitted; G3/G4 remain at original generation and independently receive 15 |
| Referral + Equalization share 42% pool/K0 | 425 combined theory, 420 shared pool, common constrained K0 and independently expected recipient payables; unconstrained K0=1 |
| CALCULATED then PENDING_45D | Every actual Referral/Equalization/Binary/Matching award has exactly these two initial statuses in order, linked by award ID; actual 45-day pending boundary |

Rate/cap evidence: existing R1.0B migration 0003_bonus_engine_core (pool/referral/binary/equalization parameters). TEST_ONLY effective dates and volumes do not approve production eligibility, event mapping or operating calendar. No production service, business rule, monetary result, migration, dependency or historical ledger/award/carry is changed.

## Verification and limits

See PASS-FAIL-MATRIX.md, focused-tests.txt, api-tests.txt, todo-gate.txt and TODO-INVENTORY.{md,json} in this directory. Final focused run: 1 suite, 24 PASS, 2 TODO. Final full API run: 17 suites, 130 PASS, 52 TODO; 27.424 seconds. TODO gate remains exit 1 for 52 placeholders. Scoped git diff whitespace validation PASS.

The fixtures use actual BinaryBonusService, ReferralBonusService, BonusQueryService, captureParameters, snapshot/replay verification, capturedSideGpv, historical Sponsor/recipient evaluation, effectiveGpv and Prisma.Decimal. Transaction-local persistence is mocked; sealSettlement is mocked. These tests establish service calculation/query/write behavior, not real DB transaction atomicity, concurrent settlement exclusion, graph SQL correctness or replay sealing. No new DB/build/Prisma/formal Security/UAT claim is made.

All gate runs observe the shared working tree, including concurrent uncommitted UX/Person API changes and one v064-golden-dataset TODO conversion. Working-tree trajectory: preceding batch 69 → this batch 52. This batch alone converts 17; the earlier Matching batch converted 3. A clean committed-source TODO count must be distinguished from this shared-working-tree snapshot until the concurrent conversion is committed. Net original-baseline reduction is not a claim of 96 release-approved cases. The historically invalid 52-TODO claim remains withdrawn; the newly observed count of 52 is independently evidenced by this batch's explicit service assertions and current inventory.

## Remaining blockers

- Bonus Engine inactive-Binary TODO: current settleBinary creates a zero-theory/zero-payable award row for an inactive recipient. The original TODO says no award; no authoritative resolution between no row and a zero marker was established. Retain it and review SSOT before modifying behavior.
- Matching Sponsor Tree traversal TODO requires actual temporal tree/SQL or DB coverage; a mocked Sponsor query does not establish it.
- Remaining global-pool, lifecycle, replay/carry, scheduling and worker/idempotency placeholders remain in the inventory. Period-wide K1/K2 replay, carry convergence/maxWeeks/resume and operational scheduling are unfinished.
- Eligible-consumption scope, formal PV/BV mapping and production calendar/cut-off remain Pending Decisions. Formal Security/UAT and Production Promotion remain BLOCKED.

Only this batch's test, inventory utility and evidence are committed. Concurrent UX/API source/evidence is preserved. No main merge or force push.
