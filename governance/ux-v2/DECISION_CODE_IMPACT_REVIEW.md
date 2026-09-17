# D1 / D2 code impact review

Status: architecture review only; no implementation or economic approval. Read against `5810149d86cdcf11057bf56dc1f2c193c18dc1b2` (production code unchanged from the previously audited baseline). This supplements the [decision worksheet](ARCHITECTURE_DECISION_WORKSHEET.md).

## D1: actual economic dependencies

| Existing source | Observed behavior | Required review implication |
|---|---|---|
| `backend/apps/api/src/modules/bonus/bonus-query.service.ts`, qualificationPlanAt | Reads effective QualificationPlanHistory; missing history throws HISTORICAL_SNAPSHOT_MISSING | Bootstrap needs approved effective plan history, not only current planLevelCode. Never substitute current plan for historical replay. |
| `backend/apps/api/src/modules/bonus/binary-bonus.service.ts`, weekly calculation around lines 69–98 | Selects plan-specific binary.weekly.cap; paired PV is min(left available, right available, cap), then Carry is reduced by paired PV | A plan choice changes both award basis and Carry trajectory. Always Active does not determine this cap. Approval must cover these downstream effects. |
| `backend/apps/api/src/modules/bonus/referral-bonus.service.ts`, historical recipient handling around lines 125–169 | Historical plan/direct count drive equalization unlock and maximum depth; plan/generation select the rate | Bootstrap Sponsor ancestry affects direct count and therefore economic eligibility. Do not treat D1 and D2 as independent cosmetic settings. |
| `backend/apps/api/src/modules/global-pool/global-pool.service.ts`, rank history and slice calculation | Uses historical rank achievement and versioned rank threshold/pool parameters | Company Active must not silently grant a Global rank. An approved starting rank/progression rule needs historical evidence. |
| `backend/apps/api/src/modules/bonus/bonus-query.service.ts`, isActiveAt/isQualificationEffectiveAt | Reads ActivePeriod and EFFECTIVE status history | A company UI label alone cannot implement Always Active. Lifecycle eligibility and financial Active are separate; proposed company semantics need an authoritative integration design. |

D1 decision checklist refinement: supply plan profile and effective history; explicitly retain or approve changes to ordinary rank progression; reference existing cap/rate definitions; specify inherited member-origin Ball treatment separately. Company-specific maxima must not be invented by this review. Rank/plan choices remain PO/SA decisions; exact numeric outcomes require the approved profile and deterministic next-phase fixtures.

## D2: Sponsor edges affect more than placement

`BonusQueryService.effectiveDirectCountAt` counts effective Sponsor relationships whose child has EFFECTIVE status history. It does not distinguish Company from Member ownership. If #2/#3 become effective direct Sponsor children of #1, they can contribute to its direct count. `sponsorAncestors` follows stored effective Sponsor edges with fixed generations; it does not infer ancestors from Binary topology.

Therefore D2 must explicitly record the Sponsor relationships of #1/#2/#3, whether company children contribute under the approved normal direct-count rule, and how referral sequence is assigned. This is refinement of D2, not a newly approved exception. Do not exclude company children from normal calculations merely to make placement work; that would require economic authority.

### Conditional founding-order analysis

[D2_FOUNDING_ORDER_REVIEW.json](evidence/D2_FOUNDING_ORDER_REVIEW.json) enumerates all 24 permutations of #4–#7. It is a static truth table of the existing first/third-left predicate, not an executed database test or an approval of any order.

Assuming Sponsor #1, no prior direct referrals and no interleaved registrations: only **4 of 24** complete orders satisfy the current rule (both sequence positions 1 and 3 must be #4/#5). With two pre-existing Sponsor referrals, only **12 of 24** satisfy it (the first founding member becomes sequence 3). The second scenario does not approve creating Sponsor edges for #2/#3; it demonstrates why company ancestry must be decided before asserting specific sequence numbers. Rejected orders stop at their first invalid placement; later rows in the table are hypothetical sequence positions, not a claim that rejected inserts consumed numbers.

The worksheet's #4→#5→#6 example assumes no prior Sponsor referrals. If company edges or other referrals already exist, recompute the actual sequence. Never reserve fake referral records or change sequence ordering to hide this conflict.

### All enforcement paths need one approved policy

| Existing source | Review implication |
|---|---|
| `organization.service.ts`, previewPlacement | Preview computes max(sequence)+1 without sequence lock. It is advisory and cannot promise the commit-time sequence/slot. It currently reports firstThirdLeftRequired solely from sequence. |
| `organization.service.ts`, allocateSponsorSequence | Locks the Sponsor Qualification row before finding next sequence. New commands must preserve serialization and idempotency; UI preview is not a reservation. |
| `qualification.service.ts`; `membership-application.service.ts`; `system-assignment.service.ts`; `qualification-placement.service.ts` | Multiple entry paths call the placement guard. Any approved narrow exception must be consistent across preview, direct creation, application, assignment and deferred placement. |
| `0013_review_r1_integrity_guards/migration.sql`, trg_binary_first_third_left | BEFORE INSERT on Binary placement checks Sponsor relationship effective at placement time. Changing only the application guard would still reject in SQL. Do not edit old migrations. |
| Same migration, trg_sponsor_update_guard | Protects current Sponsor/sequence updates. Do not repurpose historical sequence to evade the first/third rule. |

Application traversal currently selects open Binary edges (`effectiveTo: null`), whereas the SQL guard applies effective-time predicates. Future backdated/governed commands must reconcile these time semantics; this review does not claim that ordinary current placement is broken. Insertion-order tests must also cover missing/deferred Sponsor edges: the SQL trigger returns when it finds no Sponsor and cannot alone prove final cross-table consistency. Evaluate all transaction constraints before claiming a bypass; preserve final-state integrity in the reviewed design.

## Next-phase acceptance vectors (not executed here)

| ID | Given / action | Expected invariant after a decision is approved |
|---|---|---|
| DI01 | Approved company plan changes at t; calculate periods before/after t | Correct effective profile, exact cap/Carry source evidence, no current fallback |
| DI02 | Company plan history absent | Explicit failure; no maximum/default plan or zero entitlement |
| DI03 | Company Sponsor edges present vs absent | Direct count and fixed generations match approved D2; difference explained by evidence |
| DI04 | Each of 24 founding fill orders | Approved policy applied consistently, canonical topology unchanged; ordinary guards preserved |
| DI05 | Two simultaneous requests share Sponsor/slot; retry winner | Unique sequence and occupant; idempotent result; no partially created Ball/edge |
| DI06 | Preview succeeds, another request commits first | Revalidate current slot/sequence; return authoritative conflict or revised decision, not stale preview success |
| DI07 | Normal Member and noncanonical company-origin placement | No blanket COMPANY bypass; only specifically approved scope can differ |
| DI08 | Direct create/application/system assignment/deferred placement | Same policy result and audit evidence across all entry points |
| DI09 | Historical placement time differs from current graph | Application/database agree on effective topology; reject unsupported history |
| DI10 | Sponsor row inserted before/after Binary row inside transaction | Final invalid state cannot commit; validate actual constraint timing in implementation tests |
| DI11 | Return/replay after company configuration or ownership changes | Original effective plan/ancestry/destination retained; B adjustment exactly once |
| DI12 | Company Ball final entitlement | Core theory/K preserved; no duplicate member PAYABLE/PAID; A/B remain separate |

No live fixtures, schema changes, migrations or production commands were run for this analysis. The truth table validates a conditional predicate only. D1/D2 remain REVIEW_REQUIRED, and Production remains BLOCKED.
