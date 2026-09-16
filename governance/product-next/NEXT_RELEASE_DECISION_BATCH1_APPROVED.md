# UCell Next Release Decision Register — Batch 1 Approved Baseline
Status: APPROVED DESIGN BASELINE per Product Owner instruction to proceed with SA recommendations
Date: 2026-09-16
Scope: V1.1–V1.3 only; does not alter R1.0B monetary rules.

## NR-DEC-001 SYSTEM_ASSIGNMENT eligible pool — APPROVED
Use an explicit, versioned SystemAssignmentPool of enabled system Qualifications/Balls. Never infer the pool from all company/person-owned Qualifications. Entry fields include qualificationId, enabledFrom/To, priorityClass, capacityLimit?, approval reference and eligibility state. Only currently enabled/eligible entries participate.

## NR-DEC-002 SYSTEM_ASSIGNMENT selection and BFS — APPROVED DESIGN DEFAULT
Selection policy: among eligible system balls, choose the ball with the smallest eligible descendant count under the applicable placement projection. Tie-break: priorityClass -> earliest enabledAt -> stable qualificationId. After root selection, use deterministic breadth-first/level-order placement, left before right unless a higher-authority Binary placement rule defines another deterministic side order. Lock candidate placement scope transactionally/advisory, re-read and revalidate before commit. Never use untraceable randomness.

This is the default next-release policy. If Product Owner later requests fixed-priority rather than load-balanced roots, create a new policy version; do not rewrite historical placements.

## NR-DEC-003 Referral attribution 30-day rule — APPROVED
lockedUntil = first valid referral touch + 30*24 hours using server-authoritative timestamps. A competing referrer during lock is recorded but cannot replace. Same-referrer repeat touch updates lastTouchAt but does not extend lockedUntil. First valid competing touch after expiry may replace and begins a new 30-day window. Once Sponsor history exists for a Qualification, later referral attribution never changes that Sponsor.

## NR-DEC-004 NASL time windows — APPROVED INITIAL ANALYTICS POLICY
NASL is Person-level analytics only. Initial version: NEW window = first 30 days from registration while not yet satisfying ACTIVE; ACTIVE = qualifying activity within rolling 30 days; SUSPEND = previously active with no qualifying activity for day 31–90; LOST = no qualifying activity for >90 days or explicit closed relationship under policy. These thresholds are versioned and may be recalibrated prospectively; historical reports retain policyVersion. Qualification Active remains independent R1.0B truth.

## NR-DEC-005 NASL qualifying events — APPROVED PRINCIPLE
Registration supports NEW but does not itself create ACTIVE. ACTIVE is driven by a versioned set of meaningful authoritative engagement/commerce events. Initial event family includes paid/recognized purchase or repurchase and other explicitly approved meaningful member actions. Passive page view, content view or message read alone cannot make a Person ACTIVE. Exact event IDs are configuration/versioned and require evidence source.

## NR-DEC-008 OTP baseline — APPROVED
6-digit numeric OTP; 5-minute expiry; maximum 5 verification attempts per challenge; 60-second resend cooldown; maximum 5 sends per destination per rolling hour and 10 per day; progressive temporary lock/risk control on abuse. Raw OTP is never stored. Provider is abstracted; Production provider credentials, costs and provider-specific throughput are environment configuration. Security may impose stricter limits without weakening this baseline.

## NR-DEC-009 Google OIDC — APPROVED
Google OIDC is optional Person authentication/linking. It never replaces mobile verification where mobile verification is required and never replaces Formal Member KYC. Unique issuer+subject identifies a provider account. Matching email/mobile is insufficient for automatic Person merge. Linking/unlinking requires authenticated safety controls and audit.

## Consequences
These decisions may now be used to finalize schema/API/test contracts for future V1.1–V1.3 work. They do NOT authorize starting next-release implementation before Gate 0 current R1.0B Core Closure approval.

## Still pending
KYC legal/retention and exact required documents; SMS provider selection/operational account; bank verification; Sonar heat thresholds; Organization Health final policy; analytics freshness/retention/export; message audience governance; LINE push; paid activity policy. These fail closed only affected future features.