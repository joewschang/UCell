# UCell V1.1–V1.3 Backlog & Acceptance Criteria
Status: PLANNING BASELINE
Date: 2026-09-16

## Priority rule
Do not start implementation until current R1.0B Core Closure checkpoint is approved. Tracking seams may be added earlier only if non-invasive and explicitly reviewed.

## EPIC 1 — V1.1 Network Registration
P0. Contract version display/consent; basic profile; mobile OTP; create NETWORK_MEMBER; referral context preserved; LINE/Google provider-compatible identity.
Acceptance: duplicate/retry safe; raw OTP absent; consent immutable; no Qualification automatically created unless a separate approved workflow invokes it; zero-Qualification member can login/use permitted functions.

## EPIC 2 — V1.1 Formal Member Upgrade
P0. Formal data, delivery/contact, ID/bank documents, KYC submit/review/approve/reject/needs-info, bank identity history.
Acceptance: sensitive data masked; private documents BOLA/IDOR protected; concurrent approval exactly once; approval does not alter existing Sponsor/Binary history; formal status required only where rule says so.

## EPIC 3 — V1.1 Checkout Profile Completion
P0. Network member shopping prompts missing delivery address/phone without forcing Formal Member upgrade.
Acceptance: order ownership and Core server pricing unchanged; profile mutation audited/idempotent.

## EPIC 4 — V1.2 Referral Attribution
P0. Signed share token, landing, anonymous attribution, 30-day lock/replacement, Person binding, history.
Acceptance: exact boundary tests; competing referrer inside lock cannot replace; post-expiry valid referrer can replace; later attribution never rewrites Sponsor; tampered token denied.

## EPIC 5 — V1.2 System Assignment
P0 after policy decision. No-referral Sponsor conversion uses versioned eligible system-ball policy + deterministic BFS.
Acceptance: concurrency-safe; same inputs/policy produce same eligible selection; placement audit/policy hash retained; no random untraceable assignment.

## EPIC 6 — V1.2 CMS & Share
P1. Admin content/version/publish; Member browse/view/share; media/private object handling; external links.
Acceptance: publish windows/audience enforced; share generated server-side; view/share/click events deduplicated according to event semantics.

## EPIC 7 — V1.2 Activities
P1. Admin activity, capacity/waitlist; Member register/cancel; check-in-ready workflow.
Acceptance: concurrent last-seat registration safe; duplicate registration idempotent; history retained; unauthorized attendee list denied.

## EPIC 8 — V1.2 Inbox/Announcements
P1. Publication, audience snapshot, delivery/read/action evidence.
Acceptance: recipient isolation; publication idempotency; read exactly-once evidence semantics; future LINE push cannot replace canonical inbox state.

## EPIC 9 — Analytics Event Foundation
P0 early seam. Append-only AnalyticsEvent + projector checkpoint/schema version.
Acceptance: duplicate event id ignored/idempotent; out-of-order handling defined; PII prohibited; rebuild produces deterministic projection.

## EPIC 10 — V1.3 NASL
P1 after NASL policy approval. Current/transition/cohort/reactivation/churn read models.
Acceptance: Person/Qualification separation; versioned definitions; timezone boundary; denominator-zero null semantics; rebuild reconciliation.

## EPIC 11 — V1.3 12-Generation Sponsor Sonar
P1. 1..12 Sponsor generation metrics and drill-down.
Acceptance: Sponsor Tree only; depth 12 hard boundary; Active/repurchase/volume source reconciliation; authorized drill-down.

## EPIC 12 — V1.3 Binary Sonar
P1. 1..12 Binary metrics + left/right health/carry/balance.
Acceptance: Binary Tree only; no Sponsor inference; Core authoritative volume/carry; missing evidence unavailable.

## EPIC 13 — V1.3 Growth Funnels
P2. Referral/content/activity/message funnels.
Acceptance: attribution chain fixed at conversion event; no retroactive reassignment; counts reconcile with source events; filters bounded.

## EPIC 14 — Organization Health
P2 after policy approval. Explainable weighted score and heat labels.
Acceptance: score component evidence visible; versioned policy; cannot affect rank/bonus/Qualification.

## EPIC 15 — Analytics Export/Operations Brief
P2. Controlled export and daily operations summary.
Acceptance: RBAC, masking, export audit, asOf/freshness shown, no fabricated values.

## Cross-cutting Definition of Done
Build PASS; migrations from zero PASS; isolated DB Golden PASS; unit/integration/HTTP/DB assertions; BOLA/IDOR/RBAC; idempotency/concurrency where applicable; OpenAPI; accessibility/responsive UI; audit/outbox evidence; no R1.0B monetary regression; documentation and decision references updated.

## Product decisions required before affected epic Production
KYC/retention; SMS provider/limits; bank verification; SystemAssignment policy; NASL policy; Sonar thresholds; Health weights; analytics freshness/retention/export; message audience/LINE push governance; paid activity rules if introduced.
