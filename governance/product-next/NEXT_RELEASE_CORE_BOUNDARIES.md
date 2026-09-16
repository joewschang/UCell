# UCell Next Release Core Boundaries

Status: FROZEN DESIGN BOUNDARY — implementation follows current R1.0B RC closure.
Date: 2026-09-17

## Non-negotiable invariants
1. Person != Qualification; Person may own 1:N independent Qualifications/Balls.
2. NETWORK_MEMBER/FORMAL_MEMBER are Person-level states; they do not merge or replace Qualification state.
3. Member referral is Person->Person. Sponsor/Referral Tree is Ball->Ball. Binary Tree is Ball->Ball. These are three independent relationship domains.
4. Referral attribution != final Sponsor relationship. A 30-day marketing attribution may prefill Sponsor Ball but member may select another valid Sponsor Ball before Ball Sponsor confirmation. Once Sponsor edge exists, later clicks never rewrite it.
5. Formal Member requires a qualifying membership-package purchase (啟航/菁英/領袖) plus required formal data/contracts/KYC under applicable policy. Ordinary product purchase and KYC approval alone are insufficient.
6. First Ball final Sponsor owner establishes Person-level referrer. Later Balls do not change Person referrer. Ball #2+ may be sponsored by another eligible Ball owned by the same Person.
7. Sponsor Ball != Binary Parent. Sponsor owner has placement authority for the new Ball under applicable rules; placement completes Binary relationship. Ball is not effective Active placement before legal placement completes.
8. Current LINE OA uses LINE authentication. SMS OTP/Google OIDC are future Web/App feature-disabled capabilities.
9. Core monetary values and historical evidence remain authoritative and append-only under R1.0B.
10. Analytics/read models are observational. They cannot create Active, rank, placement, award, ledger, settlement, carry or payout facts.
11. CMS, activities and inbox may generate AnalyticsEvents but cannot directly mutate organization or monetary truth.

## Domain boundaries
### Identity & Compliance
Person profile, LINE provider identity, consent/KYC evidence, bank payout identity and Formal Member eligibility evidence. Future OTP/Google contracts remain dormant.

### Qualification & Organization Core
Qualification, Sponsor/Binary history, Ball setup/placement lifecycle, placement authority/evidence, Active, rules, system-assignment policy and all R1.0B organization invariants.

### Growth
Referral link/token, 30-day provisional attribution/history, CMS content/share, campaigns, activities/registrations and member inbox/publications.

### Analytics
Append-only AnalyticsEvent, NASL read models, cohorts, funnels, placement-monitor read model, 12-generation sonar and explainable Organization Health metrics.

### Commerce/Core monetary
Orders/payment recognition boundaries, qualifying membership package evidence, ProductProfile, PV/BV/RPV/EPV, bonus, carry, settlement, ledger, return/replay/recovery. Existing Core Logic Addendum v2 remains controlling.

## Formal Member / first Ball conversion
Network Member purchases a qualifying 啟航/菁英/領袖 package and completes required formal-member evidence. First Ball setup selects final Sponsor Ball. Its owner establishes historical Person referrer. Ball enters placement workflow. Formal Member identity and Ball Active placement are distinct facts and may temporarily be FORMAL_MEMBER + PLACEMENT_PENDING.

## Referral to Sponsor conversion
Marketing attribution is provisional/prefill only. Ball setup may change to another valid Sponsor Ball before confirmation. Backend validates final Sponsor Qualification under applicable rule/version. Persist attribution source and final selection separately. Confirmed Sponsor history is immutable except a separately governed administrative correction process that does not silently rewrite other histories.

## Placement
For normal referred Ball, Sponsor Ball owner selects legal Binary position. `placementDueAt = placementRequestedAt + 72h`. Overdue placement escalates to Admin monitor; authorized `QUALIFICATION_PLACEMENT_OVERRIDE` may place with reason/audit. Placement commit is concurrency-safe and revalidates target slot, operator, graph legality and unplaced state.

System-assigned no-referral case uses approved deterministic system-ball selection + SYSTEM_AUTO BFS placement and does not wait for the human 72h path.

## Multi-Ball sponsorship
Ball #2+ may choose another eligible Ball owned by the same Person as Sponsor Ball. Ownership equality is permitted; graph self-edge/cycle is not. Person.referrerMemberId remains the first formal relationship and is not changed by later Ball sponsor choices.

## Data minimization
Do not copy national ID/bank/document data into AnalyticsEvent, CMS, Activity or Referral tables. Analytics references Person/Qualification IDs only. Admin defaults to masked PII; unmask/document access requires explicit authorized action and audit.

## Release isolation
Current Backend Core Closure (remaining executable TODO, replay/carry, scheduling, Security/UAT/Production readiness) has priority. Next-release implementation occurs on a separate feature branch after an integration checkpoint and must not silently expand current RC scope.