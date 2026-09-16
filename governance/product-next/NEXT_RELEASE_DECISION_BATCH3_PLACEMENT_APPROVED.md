# UCell Next Release Decision Register — Batch 3 Formal Membership / Referral / Placement
Status: APPROVED DESIGN BASELINE
Date: 2026-09-17
Scope: next-release membership/Qualification workflow; must be reconciled with higher-authority R1.0B rules before implementation. Does not alter frozen monetary formulas.

## 1. Three independent relationship domains
A. Member referral: Person -> Person, stored as historical member referrer relationship.
B. Sponsor/Referral Tree: Qualification/Ball -> Qualification/Ball.
C. Binary Placement Tree: Qualification/Ball -> Qualification/Ball with side/position.
Sponsor Ball and Binary Parent are distinct fields and may differ. Never infer one from the other.

## 2. Formal Member eligibility
A Network Member becomes eligible to transition to FORMAL_MEMBER only through a qualifying membership-package purchase: 啟航 / 菁英 / 領袖, together with required formal-member data/contracts/KYC requirements under applicable policy.
Ordinary product purchase does not create Formal Member status.
Formal Member identity and Qualification activation are separate facts: a Person may be FORMAL_MEMBER while a newly purchased Ball is PLACEMENT_PENDING.

## 3. First Ball and Member Referrer
When the Person creates the first membership Qualification/Ball, the setup UI may prefill a Sponsor Ball from current valid referral attribution, but the purchasing member may manually enter/change the Sponsor Ball before confirmation, subject to Backend validation.
The final confirmed Sponsor Ball owner becomes the Person-level member referrer for the first formal membership relationship. Persist `referrerMemberId = owner(finalFirstBallSponsorBall)` with historical evidence.
After first Ball activation/relationship confirmation, ordinary later Ball purchases do not change `referrerMemberId`.
Administrative correction, if ever allowed, requires a separate audited correction workflow and never silently rewrites existing Sponsor/Binary histories.

## 4. Second and later Balls
For Ball #2 and above, the purchasing Person may select any Sponsor Ball allowed by the applicable rule, including another Ball owned by the same Person.
Example: B-Q2.sponsorBallId = B-Q1 is valid if B-Q1 is eligible. This does NOT change B.referrerMemberId.
Every Sponsor edge is Qualification-to-Qualification and must pass eligibility, self-edge and cycle checks.

## 5. Referral attribution semantics corrected
30-day ReferralAttribution is a marketing/prefill fact, not an immutable final Sponsor assignment. It may prefill the Sponsor Ball during Ball setup. Before Ball Sponsor confirmation, the purchasing member may replace it with another valid Sponsor Ball.
Record both attribution source and final Sponsor selection for audit/analytics. Once the Ball Sponsor edge is confirmed/created, later referral clicks do not rewrite it.

## 6. Ball purchase/setup lifecycle
Recommended lifecycle evidence:
PURCHASE_PENDING -> PURCHASED -> BALL_SETUP_PENDING -> PLACEMENT_PENDING -> PLACED -> ACTIVE.
If placementDueAt passes without placement: PLACEMENT_PENDING -> PLACEMENT_OVERDUE.
Cancellation/reversal/suspension states integrate with existing Core lifecycle and must not create a second conflicting definition of Active.

A Ball in BALL_SETUP_PENDING / PLACEMENT_PENDING / PLACEMENT_OVERDUE exists but is not yet an effective Binary placement and must not be treated as an ACTIVE Qualification for rules requiring Active placement.

## 7. Sponsor owner placement authority
After final Sponsor Ball is confirmed, its owner is authorized to place the new Ball into a legal Binary position under applicable system rules. Authorization is evaluated as `operator Person owns sponsorBallId` plus applicable placement permission; do not authorize merely because operator is related to the new member.
The Sponsor owner chooses a legal Binary parent/side. Backend revalidates target availability, tree legality and authorization at commit time.

## 8. 72-hour placement SLA
When Ball enters PLACEMENT_PENDING, set `placementDueAt = placementRequestedAt + 72 hours` using server-authoritative timestamp / approved operational timezone semantics. At deadline without placement, transition/derive PLACEMENT_OVERDUE and emit escalation evidence.
No arbitrary end-of-day interpretation.

## 9. Admin intervention
PLACEMENT_OVERDUE appears in Admin Qualification Placement Monitor. Authorized Admin role/permission `QUALIFICATION_PLACEMENT_OVERRIDE` may place the Ball after reviewing Sponsor Ball and legal Binary positions. Admin must provide reason code/comment as policy requires. Backend performs the same legality/concurrency validation as Sponsor-owner placement.
PlacementEvidence records qualificationId, sponsorBallId, binaryParentBallId, side, placedByType SPONSOR_OWNER|ADMIN_OVERRIDE|SYSTEM_AUTO, placedByPersonId?, placedAt, reasonCode?, policyVersion, previousStatus, correlationId.

## 10. Placement monitoring dashboard
Admin read model includes pending count, aging buckets 0–24h / 24–48h / 48–72h / overdue, package type, new Ball, owner member, Sponsor Ball, Sponsor owner, requestedAt, dueAt, status, intervention status and audit link. Alerts/escalations are operational read models and do not mutate monetary truth.

## 11. Concurrency
Placement is transaction-safe. At commit: lock/revalidate new Ball still unplaced; lock/revalidate target Binary slot; validate operator; validate no Sponsor/Binary cycle; create Binary history + PlacementEvidence + lifecycle transition atomically. Competing request receives deterministic conflict (e.g. PLACEMENT_CONFLICT) and must choose/reload another position. Frontend availability is never authoritative.

## 12. No-referral/System Assignment
If Ball setup has no valid Sponsor Ball after member choice, use approved SYSTEM_ASSIGNMENT policy. System selects eligible System Sponsor Ball deterministically. For system-assigned cases, default next-release behavior is SYSTEM_AUTO deterministic BFS placement immediately, rather than waiting 72h for a human Sponsor owner. Record SYSTEM_AUTO evidence/policy version.

## 13. Referral code model
A Person/member owns a member referral code. The code resolves to the member and an applicable/default referral Ball context. For analytics, ReferralAttribution stores both referrerMemberId and referrerQualificationId where resolved. The final Ball setup may change Sponsor Ball. Person-level referrer is established from the final first-Ball Sponsor owner, not blindly from the original URL.

## 14. Cycle and integrity rules
No Ball may sponsor/place itself. Sponsor graph and Binary graph are independently acyclic. A Person may own multiple Balls in ancestor/descendant Sponsor relationships; ownership equality is not itself a cycle. Cross-ball self-ownership sponsorship is allowed for Ball #2+ if graph legality/rules pass.

## 15. Formal membership activation evidence
Persist FormalMembershipActivationEvidence linking Person, qualifying package order/line, first Qualification, final first Sponsor Ball, referrerMemberId, applicable contract/KYC evidence, ruleVersion and effectiveAt. Do not derive later from mutable current state.

## 16. Implementation gate
This document corrects prior next-release assumptions where ReferralAttribution was treated too closely as final Sponsor assignment or where KYC approval alone implied Formal Member. Update ERD/API/readiness/golden journey before next-release coding. Current R1.0B Gate 0 remains higher-priority and unchanged.