# UCell R1.0B Core Logic Addendum v2

Status: APPROVED SA DECISION REGISTER ADDENDUM
Date: 2026-09-16
Baseline: R1.0B FROZEN
Authority: Product Owner instructed SA to execute the proposed system-rule/core-logic updates.

This addendum fills implementation ambiguities where the current R1.0B source set is silent. It does **not** override a higher-authority filed or formally approved company document. If such a conflict is discovered, stop the affected production path and raise SSOT conflict review.

## 1. Immutable invariants

- Person and Qualification are different aggregates; Person may own 1:N Qualifications/Balls.
- Organization, Active, PV/RPV/EPV, Bonus, Carry, Ledger and settlement context are Qualification-scoped unless an endpoint/rule explicitly declares Person scope.
- Sponsor Tree and Binary Tree are separate structures.
- Historical calculation/replay uses historical tree, Active, ownership, parameter and calendar snapshots; missing/corrupt historical evidence fails closed.
- Monetary/volume history is append-only. Return, reversal, clawback and recovery never overwrite original facts.
- Frontend/Admin/AI never calculate or write official monetary results independently of Core.
- Rule/Parameter/Calendar versions are immutable, effective-dated and traceable.

## 2. Recognition event model

Order lifecycle and economic recognition are separated:

`OrderCreated -> PaymentConfirmed -> ConsumptionRecognition -> VolumeRecognition`

- OrderCreated: no official volume.
- PaymentConfirmed: payment evidence only; no volume by itself.
- ConsumptionRecognition: authoritative eligibility event under ProductProfile + RuleVersion.
- VolumeRecognition: immutable PV/BV/RPV/EPV-related recognition facts, scoped to source line, Qualification, period/time and parameter snapshot.
- Return POSTED creates linked reversal events; original recognition rows remain unchanged.

PV and BV are independent values/fields. A product may configure them equal, but code must never hardcode equality. Existing historical GPV/RPV/EPV facts are not renamed/migrated by inference.

## 3. Eligible personal consumption

Monthly EPV accumulator uses only eligible ConsumptionRecognition events.

Eligible by default only when all are true:
- personal-consumption purpose under the effective rule;
- paid/confirmed authoritative consideration;
- line is not a gift, free replacement, company compensation/subsidy or zero-consideration fulfillment;
- ProductProfile/RuleVersion explicitly permits recognition.

Excluded unless a later formally approved rule says otherwise:
- gifts/free samples;
- free replacement/compensation fulfillment;
- company subsidy/zero-consideration lines;
- tax, freight and payment fees;
- points-only redemption.

For mixed points + cash, only authoritative eligible cash consideration is recognized by default. This rule is prospective and versioned.

EPV remains Qualification + calendar-month cumulative:

`EPV = max(0, eligible monthly personal consumption - 2000) * 60%`

Return POSTED reverses the original eligible-consumption event and recomputes the whole historical month; never apply `returnAmount * 60%` mechanically.

## 4. Operational calendar

All production scheduling must use `OperationalCalendarVersion` (logical model) with at least:

- id/version
- timezone (`Asia/Taipei` baseline)
- period definition
- recognition cut-off
- settlement cut-off/schedule
- effectiveFrom/effectiveTo
- approvalReference
- immutable snapshot/hash where applicable

No production service may hardcode weekday/hour/month-end policy. Exact production cut-off clock values remain Product Owner configuration pending and affected production posting stays fail-closed until approved.

## 5. Binary inactive evidence

When historical Binary eligibility is inactive/ineligible:
- preserve deterministic zero-entitlement calculation evidence and reason code;
- do not create payable/monetary credit;
- do not treat absence of an Award row as sufficient audit evidence;
- replay against historical Active snapshot.

## 6. Matching / Equalization traversal

- Traverse historical Sponsor Tree, not Binary Tree.
- Recipient is Qualification-scoped.
- Never substitute another Ball owned by the same Person.
- Historical Active/eligibility snapshots determine recipient eligibility.
- Existing higher-authority generation/depth rules remain authoritative.
- If an edge case does not specify skip/stop/compression behavior, fail closed; do not invent compression.

## 7. Carry lifecycle

Carry belongs to Qualification/Binary position, not Person.

Conceptually:

`CarryOut = replayed effective CarryIn + eligible side volume - consumed/matched volume +/- linked historical adjustments`

subject to the effective Binary RuleVersion.

- Suspend does not erase carry.
- Reactivation resumes preserved/replayed carry.
- Person ownership transfer does not move carry to another Qualification.
- Permanent termination/expiry clears carry only when an explicit effective rule authorizes it.
- Historical reversal replays forward until carry converges.
- `maxWeeks` is an engineering safety guard. It must not silently truncate business entitlement; non-convergence fails/pauses with evidence and resumable checkpoint.

## 8. 45D lifecycle

Lifecycle remains conceptually:

`CALCULATED -> PENDING_45D -> EFFECTIVE -> PAYABLE -> PAID`

The 45D anchor derives from the authoritative settlement period end/cut-off policy captured in the applicable OperationalCalendarVersion, not from delayed job execution time. `pendingUntil` is persisted as historical evidence and is not moved merely by replay execution delay.

- Adjustment during hold: append-only entitlement delta.
- Adjustment after PAID: recovery/clawback/offset.
- Original Award/PAID history remains immutable.

## 9. Return workflow

Required semantic states:

`REQUESTED -> APPROVED -> RECEIVED -> POSTED -> REFUNDED`

Equivalent implementation names are acceptable only if these semantics remain explicit.

- REQUESTED/APPROVED/RECEIVED: no official volume reversal.
- POSTED: authoritative economic/volume reversal and historical replay trigger.
- REFUNDED: payment refund completion; separate from volume reversal.
- Every return has a unique idempotency key.
- Multiple returns cannot exceed remaining reversible quantity/value.
- Redelivery/retry must not duplicate reversal, recovery, outbox or ledger postings.

## 10. Replay and historical evidence

Return/reversal replay must:
1. locate original recognition and historical period;
2. load historical Qualification/ownership/tree/Active/parameter/calendar snapshots;
3. append linked reversal evidence;
4. recompute affected period entitlement;
5. propagate downstream K0/K1/K2/pool/carry dependencies as required;
6. continue carry replay until convergence;
7. post only deltas/recovery while preserving original Award/Ledger facts;
8. remain idempotent and transactionally safe.

Missing historical evidence must never be reconstructed from current state.

## 11. Remaining configuration/SSOT blockers

The following remain fail-closed for Production until separately approved/resolved:

1. Exact weekly/monthly recognition and settlement cut-off clock values.
2. Deterministic migration mapping for pre-existing GPV facts into formal PV/BV fields/events.
3. Any Matching depth-specific skip/stop/compression edge case absent from higher-authority R1.0B rules.

These blockers do not prevent unrelated engineering, UX, infrastructure or tests from continuing.

## 12. Required engineering follow-through

Backend Codex must convert this addendum into versioned configuration/domain events/tests rather than scattered constants. Required coverage includes:

- ConsumptionRecognition eligibility/exclusion matrix;
- PV/BV independence test;
- Return POSTED recognition reversal and monthly EPV recomputation;
- zero-entitlement Binary evidence;
- historical Sponsor traversal/no cross-Ball substitution;
- carry suspend/reactivate/transfer/convergence/resume;
- 45D anchor stability under delayed execution/replay;
- return state machine and multi-return bounds;
- fail-closed missing historical/calendar/mapping evidence;
- idempotency/concurrency/rollback/outbox tests.

Production Promotion remains BLOCKED until normal Release Gates, operational credentials, UAT, backup/restore and outstanding engineering obligations pass.
