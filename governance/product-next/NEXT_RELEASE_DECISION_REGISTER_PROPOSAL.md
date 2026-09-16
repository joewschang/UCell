# UCell V1.1–V1.3 Decision Register — SA Proposal
Status: PROPOSED; Product Owner approval required where marked P0/P1.
Date: 2026-09-16

This register resolves implementation ambiguity before coding. It does not modify R1.0B monetary rules.

## NR-DEC-001 SYSTEM_ASSIGNMENT eligible pool [P0]
Question: when no valid referral exists, which system balls can receive placement?
SA proposal: maintain a versioned `SystemAssignmentPool` of explicitly enabled Qualifications. Never infer from all company-owned/person-owned balls. Each entry has qualificationId, enabledFrom/To, priorityClass, capacityLimit?, current eligibility and approval reference. Only ACTIVE/eligible entries under the applicable policy participate.
Rationale: auditable, reversible by future policy version, avoids hidden ownership assumptions.

## NR-DEC-002 SYSTEM_ASSIGNMENT selection/tie-break [P0]
SA proposal: choose the eligible system ball with the smallest current eligible descendant count under the placement policy; ties resolve by priorityClass, then earliest enabledAt, then stable qualificationId. After root selection, place by breadth-first/level-order, left before right unless the applicable Binary placement rule defines a different deterministic side order. Acquire transactional/advisory lock on candidate placement scope and revalidate before commit. No random selection.
Pending: confirm whether business wants load balancing across system balls or a fixed priority order. Until approval, Production system assignment is blocked.

## NR-DEC-003 Referral 30-day window [APPROVAL CANDIDATE]
Proposal: lockedUntil = first valid touch + 30*24h under server timestamp. Competing referral during active lock cannot replace. Same-referrer repeat touch updates lastTouchAt but does not extend lockedUntil. First valid competing touch after expiry replaces and begins a new 30-day lock. Existing Sponsor is immutable.

## NR-DEC-004 NASL definitions [P0 for V1.3]
Proposal (Person analytics, not Qualification Active):
NEW = Person registered within the configured New window and not yet satisfying ACTIVE definition.
ACTIVE = Person has at least one qualifying engagement/commerce activity in the rolling Active window; exact qualifying event set is versioned.
SUSPEND = previously ACTIVE but no qualifying activity for Suspend threshold, while not yet Lost.
LOST = no qualifying activity for Lost threshold or explicit closed relationship per policy.
Default design candidate: New window 30 days; Active rolling 30 days; Suspend day 31–90; Lost >90 days. Do NOT activate these numeric thresholds until Product Owner approves.
Qualification Active remains the R1.0B operational rule and is never replaced by NASL.

## NR-DEC-005 NASL qualifying events [P1]
SA proposal: registration alone supports NEW, not ACTIVE. ACTIVE qualifying events should prioritize authoritative commerce/repurchase/formal membership engagement and optionally defined meaningful member actions; mere page view/message read should not make a Person ACTIVE. Version event set.

## NR-DEC-006 Sonar heat thresholds [P1]
Proposal: compute labels from multi-metric rules, not Active rate alone. Initial candidate: GROWING when new+repurchase trend materially improves; HOT when Active>=75% and Repurchase>=65%; WATCH when Active 55–74%; COOLING when Active 40–54% or negative trend; COLD when Active<40%; CRITICAL when Active<30% plus elevated Suspend/Lost risk. Exact thresholds must be calibrated with real data before Production.

## NR-DEC-007 Organization Health weights [APPROVAL CANDIDATE]
Proposed weights: Active 25%, Repurchase 20%, New Growth 15%, Suspend/Lost Risk 15%, Binary Balance 10%, Depth Activity 10%, Engagement 5%. Score is analytics-only and cannot affect rank/bonus/Qualification. Version weights and components.

## NR-DEC-008 OTP policy [P0 for V1.1]
SA proposal baseline: 6-digit numeric OTP; 5-minute expiry; max 5 verify attempts per challenge; resend cooldown 60 seconds; max 5 sends per destination per hour and 10/day; progressive temporary lock on abuse; provider abstraction with no provider-specific semantics in domain. Exact provider/cost/rate policy can be adjusted by configuration. Production requires provider selection and abuse monitoring.

## NR-DEC-009 Google identity [APPROVAL CANDIDATE]
Google OIDC is optional authentication/linking. It never replaces verified mobile for workflows that require mobile verification, and never replaces Formal KYC. Unique issuer+subject identifies provider account; email equality cannot auto-merge Persons.

## NR-DEC-010 KYC document policy [P0 legal/operations]
Proposal: collect only documents explicitly required for Formal Member onboarding. ID images and bankbook cover stored privately with retention class; default Admin list is masked. Automated OCR may assist extraction later but cannot auto-approve without an approved verification policy. Final retention/deletion period must follow legal/operational counsel and is not guessed in code.

## NR-DEC-011 Bank verification [P1]
Proposal: start MVP with bank master validation + account format validation + manual/authorized review of account holder evidence. Keep a provider interface for future penny-drop/API verification. Do not claim bank ownership verified merely from uploaded image.

## NR-DEC-012 Analytics freshness [P1]
Proposal: operational dashboards target <=15 minutes projection lag; settlement/monetary read models show authoritative Core asOf and may use stricter refresh. Every dashboard displays asOf/status. Alert if projector lag exceeds SLO. Final SLO should be validated against Azure cost/workload.

## NR-DEC-013 Analytics retention/export [P1]
Proposal: raw AnalyticsEvent retention is configurable and minimized; aggregate projections may be longer-lived. Export requires ANALYTICS_EXPORT permission, masking, row limits and audit. Never export KYC/bank/national ID through analytics.

## NR-DEC-014 Message audience governance [P1]
Proposal: audience definitions are server-side saved selectors; publication resolves an immutable audience snapshot. OPERATIONS may publish ordinary operational/content messages; sensitive financial/compliance messages require higher approval policy. No arbitrary client-supplied Person list without authorization/audit.

## NR-DEC-015 LINE push [P2]
Proposal: canonical UCell Inbox first. LINE push is a future delivery adapter referencing MessagePublication/Delivery. Push failure never deletes inbox message. Opt-out/channel policy handled separately.

## NR-DEC-016 Paid activities [P2]
Proposal: V1.2 activities are free registration by default. Do not couple activity registration to Order/Refund until paid-event business rules are separately approved.

## Approval sequencing
Before V1.1 Production: DEC-008,010,011 plus legal retention/provider decisions.
Before V1.2 System Assignment Production: DEC-001,002. Referral DEC-003 should be frozen before Sprint 5.
Before V1.3 Production: DEC-004,005,006,007,012,013.
Messaging: DEC-014 before broad publication; DEC-015 can remain post-MVP.

## Fail-closed rule
Unapproved decision blocks only its affected feature path. It must not block unrelated current R1.0B Core Closure or alter monetary semantics.