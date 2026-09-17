# Architecture decision worksheet — D1 / D2

Concrete candidate: [bootstrap Sponsor sequence review](BOOTSTRAP_SPONSOR_SEQUENCE_REVIEW.md) shows #2/#3 consuming #1's actual sequences 1/2 and a lawful founding sequence 3–6. It remains pending confirmation and distinguishes referral registration order from later placement order.

Source-level review: [code impact and acceptance vectors](DECISION_CODE_IMPACT_REVIEW.md) explains plan/cap/Carry dependencies, company Sponsor direct-count effects and the conditional 24-order placement table. The example below assumes no prior Sponsor referrals; company bootstrap Sponsor ancestry is itself pending.

Status: PROPOSED FOR PO/SA REVIEW. This worksheet does not approve economics or authorize implementation. It continues the completed Phase 1 review package at commit `98f282a1f2ceba761735635a5558daf7b9e19360`. On continuation, origin had no newer commits and Issue #2 still contained the same six captured addenda.

## D1 — Company bootstrap plan and rank

Already approved: company Balls are Always Active; the normal authoritative award calculation applies before company entitlement routes to Reservoir B. These rules do not specify a plan, rank, unlock depth, cap or Global eligibility. `Qualification.planLevelCode` is required by the existing model; assigning an arbitrary maximum or minimum changes economic behavior.

Recommended decision form: approve an explicit, effective-dated bootstrap configuration for each of #1/#2/#3. PO/SA must supply or reference an authoritative definition for:

| Required decision | Value to be approved | Consequence |
|---|---|---|
| planLevelCode | Existing approved code or separately approved company profile | Determines plan-dependent calculation inputs |
| rank and progression | Initial rank plus ordinary progression or an explicitly approved company rule | Determines rank-dependent eligibility; Always Active alone grants none |
| unlock/cap/rate dependencies | Reference approved rule/parameter version; list any company-specific exception | Prevents implicit full privileges or invented rates |
| effective boundary | New-tree activation time and configuration version | Enables deterministic replay without rewriting old history |
| inherited member-origin company Balls | Reference the approved inheritance policy for retained plan/rank | Must not silently apply bootstrap configuration to every transferred Ball |

Option A (recommended): use an explicitly approved versioned configuration referencing normal existing rule definitions. Option B: define a new company-specific profile; this requires an additional economic decision and acceptance cases. Neither option may be filled by engineering guesswork. Unresolved values block activation/calculation, not merely display labels.

Acceptance after approval: #1/#2/#3 use exactly the approved profile; ordinary members remain unchanged; past periods use the historical configuration; replay preserves theory/K/cap and routes the final entitlement only once to B. An unknown configuration fails closed rather than producing zero or maximum eligibility.

## D2 — Company Sponsor and canonical founding placement

PARTIALLY RESOLVED by [PO operating-unit clarification](COMPANY_BALL_OPERATING_UNIT_DECISION.md): company Balls are independent operating units and participate in actual referral ordering like other Balls. The earlier default preference for a founding exception is withdrawn. Actual Sponsor edges and valid placement flow remain to be specified.

Already approved: founding #4–#7 are sponsored by Company, while their Binary parents are #2/#3. Sponsor cannot be inferred from Binary parent. Canonical bootstrap positions remain fixed; ordinary member placement constraints remain enforced.

Recommended architecture candidate, still requiring approval: designate tree #1 as the Company's Sponsor Qualification for that tree, backed by CompanyPrincipal evidence. Explicitly decide Sponsor ancestry of company #1/#2/#3; Binary edges do not answer this question. This choice affects fixed Sponsor generations and entitlement evidence, so it is not a display-only choice.

Concrete collision: if founding slots are filled #4, #5, #6, the third Company referral (#6) is on #1's right side. Existing `OrganizationService.assertFirstThirdLeftRule` and migration 0013 require first/third referrals in the left subtree. Arbitrary slot fill order creates further cases; assigning sequence from slot number conceals the conflict.

| Option | Required approval / tradeoff |
|---|---|
| A: per-tree Sponsor #1 using ordinary actual referral sequence and placement guards | Specify company Sponsor ancestry and bootstrap referral order; validate founding placements against the actual sequence. No company-only exemption. |
| B: principal-only Company Sponsor edges | Requires mixed-type historical Sponsor traversal and generation semantics; larger Core impact. Cannot reuse the current Qualification-only relationship as-is. |
| C: a global designated Company Sponsor Qualification | Requires explicit cross-tree Sponsor attribution and economic ancestry decisions. Binary volume and Carry must remain tree-isolated. |

Option A remains a possible Qualification-based designation, not an approved Sponsor graph. Any CompanyPrincipal representation must preserve each operating Ball and its independent sequence. Principal-only or global designation alternatives cannot merge Ball economics or bypass ordinary ordering.

Acceptance after graph approval: evaluate all 24 founding-slot orders for the correct accept/reject result, not universal success. Concurrent claims cannot double-occupy; ordinary first/third-left checks remain enforced; historical replay uses actual designation, sequence and ancestry.

## Bounded next-phase proposal

An independently reviewable initial implementation slice could cover versioned semantic/catalog schemas, typed evidence contracts, server context/classification contracts and deterministic provider-free contract tests. It would not activate company economics, implement migrations, connect providers or deploy. This is a proposed scope for explicit authorization, not a claim that Phase 1 approved implementation. Production remains BLOCKED.

Record the eventual disposition with decision ID, exact selected values/option, approver, authority reference, effective boundary, affected specification version and acceptance evidence. Until then [pending decisions](PENDING_ARCHITECTURE_DECISIONS.md) stays REVIEW_REQUIRED. See the [review report](PHASE1_ARCHITECTURE_REVIEW_REPORT.md) for the complete delivered package.
