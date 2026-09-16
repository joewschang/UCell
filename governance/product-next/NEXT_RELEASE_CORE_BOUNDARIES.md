# UCell Next Release Core Boundaries

Status: FROZEN DESIGN BOUNDARY — implementation follows current R1.0B RC closure.
Date: 2026-09-16

## Non-negotiable invariants
1. Person != Qualification; Person may own 1:N independent Qualifications/Balls.
2. NETWORK_MEMBER/FORMAL_MEMBER are Person-level states; they do not merge or replace Qualification state.
3. Sponsor Tree != Binary Tree. Referral attribution != Sponsor relationship. A 30-day marketing attribution change never rewrites an existing Sponsor edge.
4. Formal-member KYC approval is a prerequisite gate for formal-member-only Qualification creation, but KYC services never calculate PV/BV/RPV/EPV/bonus.
5. Core monetary values and historical evidence remain authoritative and append-only under R1.0B.
6. Analytics/read models are observational. They cannot create Active, rank, placement, award, ledger, settlement, carry or payout facts.
7. CMS, activities and inbox may generate AnalyticsEvents but cannot directly mutate organization or monetary truth.
8. LINE/Google identities authenticate/link Person only; Qualification ownership is always server-authorized.

## Domain boundaries
### Identity & Compliance
Person profile, provider identities, mobile OTP evidence, consent evidence, KYC application/evidence, bank payout identity and Formal Member approval.

### Qualification & Organization Core
Qualification, Sponsor/Binary history, placement, Active, rules, system-assignment policy and all R1.0B organization invariants.

### Growth
Referral link/token, 30-day attribution/history, CMS content/share, campaigns, activities/registrations and member inbox/publications.

### Analytics
Append-only AnalyticsEvent, NASL read models, cohorts, funnels, 12-generation sonar and explainable Organization Health metrics.

### Commerce/Core monetary
Orders/payment recognition boundaries, ProductProfile, PV/BV/RPV/EPV, bonus, carry, settlement, ledger, return/replay/recovery. Existing Core Logic Addendum v2 remains controlling.

## Referral to Sponsor conversion
Marketing attribution remains provisional until a Qualification workflow needs a Sponsor. At conversion time Backend must validate the attributed referrer Qualification against the applicable rule/version. Once Sponsor history is created it is historical Core evidence and cannot be changed by later referral clicks.

If no valid referral is available, SYSTEM_ASSIGNMENT may be invoked only under an approved versioned policy. It must be deterministic, concurrency-safe, auditable and use breadth-first/level-order placement within the configured eligible system-ball pool. Exact pool/tie-break rules remain Pending Decision.

## Data minimization
Do not copy national ID/bank/document data into AnalyticsEvent, CMS, Activity or Referral tables. Analytics references Person/Qualification IDs only. Admin defaults to masked PII; unmask/document access requires explicit authorized action and audit.

## Release isolation
Current Backend Core Closure (remaining executable TODO, replay/carry, scheduling, Security/UAT/Production readiness) has priority. Next-release implementation must occur on a separate feature branch after an integration checkpoint and must not silently expand the current RC scope.
