# UCell R1.0B Product Owner Boundary Decisions — 2026-09-17

Status: PRODUCT OWNER APPROVED
Baseline: R1.0B FROZEN + Decision Register v3

This document records final boundary decisions that refine Decision Register v3. These are approved business rules, not pending questions.

## Settlement cut-off
- Timezone: Asia/Taipei.
- The 10th and 25th settlement cut-offs are exactly 00:00:00 local time.
- Use half-open periods `[previous_cutoff, current_cutoff)`.
- An event exactly at 00:00:00 on a cut-off date belongs to the new settlement period.
- K0 pool numerator and Referral + Referral Matching Theory denominator use the same settlement window.

## Binary week to 10/25 batch
- Binary week is never split by a 10th/25th settlement cut-off.
- Binary week closes Sunday 00:00 Asia/Taipei.
- If a Binary week crosses a 10th/25th cut-off, the completed weekly result belongs to the next applicable 10th/25th settlement batch after the weekly close.

## Active and return replay
- Active is Qualification/Ball scoped.
- Only the threshold-crossing transaction and subsequent eligible events can use the newly established Active state; no event before the threshold timestamp is backfilled.
- If Return POSTED causes historical eligible monthly consumption to fall below the threshold or moves the threshold-crossing timestamp, historical Active intervals must be recomputed.
- Awards that lose historical Active eligibility are reversed by append-only adjustment; if already PAID, use recovery/clawback/offset while preserving the original PAID evidence.

## Eligible-consumption accumulator
- Active and EPV use the same authoritative `Qualification x calendar month` eligible-consumption accumulator.
- Only transactions/lines explicitly eligible under the effective ProductProfile/RuleVersion enter this accumulator.
- The NT$2,000 threshold is evaluated against this shared accumulator.
- EPV is calculated from the amount above the same NT$2,000 threshold.

## Global Pool and Reservoir A
- Global Pool is conserved as: `Global Pool = Distributed Global + Reservoir A transfer` for the period, subject only to deterministic currency rounding.
- All undistributed Global amounts flow to Reservoir A, including no-qualified-recipient amounts, eligibility-failure remainder and deterministic rounding residue.
- Reservoir A is accrual-only for the current scope: inflow is implemented; automatic outflow/distribution is not implemented.
- Reservoir A must not automatically supplement K0, K1, K2 or Global distributions.
- Any future Reservoir A outflow requires a separately approved RuleVersion/decision.

## Multiple Qualification acquisition
- A Person/member may acquire additional Qualifications/Balls by purchasing an approved membership-qualification package.
- There is no system-defined maximum number of Qualifications/Balls per Person.
- Package purchase/qualification creation must be idempotent and auditable; retry must not create duplicate Qualifications.
- Every Qualification remains an independent scope for Active, volume, organization, Carry, Bonus, Global eligibility, Ledger and Settlement.

## Qualification exit and company succession
- Qualification/Ball is never deleted on member exit.
- On exit, Admin assigns the Qualification to a designated company holder/company Ball management context.
- Qualification identity, Sponsor position, Binary position, Carry and historical economic/audit evidence remain intact.
- The former holder ceases future entitlement from the effective transfer/exit time; the Qualification continues under the designated company holder according to effective rules.

## Inventory scope deferral
- PICK/SHIP inventory accounting timing is intentionally deferred and is not a blocker for the current Bonus/Member/Admin Stage UAT scope.
- Do not infer PICK/SHIP accounting rules in this implementation batch.

## Stage manual UAT admin access
- Stage must provide the Product Owner a usable administrative login path for manual UAT after deployment.
- Do not commit passwords or reusable credentials to Git, fixtures, logs or reports.
- If Stage supports a Stage-only local/test admin, provision it securely and deliver/reset the temporary password outside source control; it must not authenticate against Production.
- If Admin is Entra-only, provide the approved Stage Entra test-user login path instead of introducing an authentication bypass.
- Automated tests must verify that Stage test identity/configuration cannot authenticate to Production.

## Required executable boundary evidence
At minimum cover:
1. event at cut-off minus 1 second vs exact 00:00 cut-off;
2. K0 numerator/denominator identical settlement window;
3. Binary week crossing 10th/25th is not split and lands in next applicable batch;
4. threshold transaction itself Active, earlier events not backfilled;
5. Return POSTED moves/removes historical Active and reverses affected entitlement;
6. Active and EPV read the same accumulator;
7. Global distributed + Reservoir A equals Global Pool after deterministic rounding;
8. Reservoir A retry/replay exactly-once and no automatic outflow;
9. repeated qualification-package delivery does not duplicate a Ball;
10. one Person may own multiple isolated Balls without a maximum-count rule;
11. member exit changes holder but never deletes/repositions Qualification;
12. Stage manual-UAT admin identity is Stage-only and cannot authenticate to Production.
