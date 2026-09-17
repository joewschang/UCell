# Bootstrap Sponsor sequence — concrete candidate for review

Status: CANDIDATE, NOT APPROVED. This review applies the approved [independent company operating-unit principle](COMPANY_BALL_OPERATING_UNIT_DECISION.md). The candidate Sponsor graph below was presented to PO for confirmation; no answer is assumed. It requires no invented skip, fake referral or company-specific first/third-left exception.

## Candidate graph and one valid order

Assumptions: this is a NEW tree, #1 has no existing direct referrals, #2 and #3 are real independent company Qualifications, and #1 is explicitly designated as Sponsor for #2–#7. The upstream Sponsor of #1 is a separate unresolved relationship. No unrelated referrals interleave in this illustrative sequence.

| Qualification / position | Owner | Actual Sponsor | Sponsor sequence under #1 | Binary parent / side | First/third-left predicate |
|---|---|---|---|---|---|
| #1 | Company | Unresolved upstream/root disposition | Not its own referral | None; Binary root | Root creation needs its own reviewed contract |
| #2 | Company | #1 | 1 | #1 / LEFT | Satisfied: direct left child |
| #3 | Company | #1 | 2 | #1 / RIGHT | Not required for sequence 2 |
| #4 | Member when actually created | #1 | 3 | #2 / LEFT | Satisfied: within #1 left subtree |
| #5 | Member when actually created | #1 | 4 | #2 / RIGHT | Not required for sequence 4 |
| #6 | Member when actually created | #1 | 5 | #3 / LEFT | Not required for sequence 5 |
| #7 | Member when actually created | #1 | 6 | #3 / RIGHT | Not required for sequence 6 |

This is a concrete feasible sequence under the existing placement predicate, not proof of a working bootstrap command. Sponsor edges are all to #1 in this candidate; #2/#3 being Binary parents does not make them Sponsors of #4–#7. Their Sponsor direct counts therefore differ from #1's, even though each has a Binary subtree. Changing this graph changes economic generations and cannot be treated as a layout preference.

## Registration sequence is not slot numbering or placement order

Sponsor sequence belongs to the actual Sponsor relationship creation order. An existing pending-placement Ball retains its recorded Sponsor sequence when later placed. Consequently the prior 24-order truth table applies to creation/referral order with matching placement order, not arbitrary rearrangement of already registered Balls.

If the first real founding referral after #2/#3 is assigned sequence 3, it must be placed somewhere permitted in #1's left subtree; among the four canonical founding slots this means #4 or #5. A first attempt at #6/#7 cannot be accepted merely because those slots are available. Once sequence 3 has a lawful placement, later sequences still follow every applicable normal guard. Do not reserve a fictional third referral to make right slots available.

If a pending-placement Ball already owns sequence 3, a newly created Ball can have sequence 4 even when the earlier Ball remains unplaced. Their final placements are checked against their own recorded sequences. This candidate does not define a new policy that requires all referrals to finish placement in registration order. Preview must distinguish next sequence, an existing Ball's sequence and available slot; commit rechecks whichever operation applies.

For distinct Company Sponsor Balls, sequence counters remain independent. No global company-owned ordering replaces the existing per-Sponsor sequence. Company #2/#3 real Sponsor referrals count under #1 just like Member referrals; an unrelated referral changes the later numbers and must not be ignored.

## Root boundary and command implications

Existing `Qualification.sponsorRelation` is optional in Prisma, so a Ball without a Sponsor row is representable. This is not proof that a new Company root should have no upstream Sponsor. Existing `CreateQualificationDto` and `QualificationService.create` require Person, Sponsor and Binary parent; they cannot be reused unchanged for a Company-owned Binary root. The new-tree aggregate contract must explicitly handle company ownership and root topology after approval. A self-Sponsor or self-Binary-parent is not a valid workaround; existing cycle protections remain.

PO/SA must choose either a Sponsor-root boundary for #1 or an explicit actual upstream Sponsor relationship. An external Sponsor introduces its own sequence, placement compatibility and historical economic ancestry checks; it does not merge Binary trees or permit cross-tree Carry. Do not assume cross-tree Sponsor placement is universally valid merely because Sponsor and Binary are different relations.

The reviewed tree creation proposal still creates #1/#2/#3 atomically. If this candidate is approved, within that transaction insert actual #2/#3 Sponsor evidence in the approved deterministic order and validate their canonical Binary placements. Preserve owner/type/plan/status histories, idempotency and audit as already specified. #4–#7 remain empty positions until real approved member creation; they receive no Sponsor records or sequence numbers in advance.

## Required disposition and evidence

This candidate would resolve the previously illustrated #6-as-third conflict by counting the real #2/#3 referrals, rather than introducing an exception. It does not resolve D1 plan/rank or #1's upstream Sponsor. Confirm the graph and ordering before labeling it approved; if another graph is selected, recompute the sequence and economic ancestry from that graph.

Later implementation tests must cover: exact #2/#3 order and retry stability; founding #4→#5→#6→#7; first founding referral attempting #6/#7; existing pending-placement sequence 3 followed by sequence 4; unrelated interleaved referrals; separate Company Sponsor counters; root cycle rejection; replay retaining the approved graph and actual historical order. These tests were not executed in Phase 1.

Verification in this review is limited to the six-row static first/third-left predicate and comparison with existing source contracts. No schema/migration/runtime change or deployment is authorized. Production remains BLOCKED.
