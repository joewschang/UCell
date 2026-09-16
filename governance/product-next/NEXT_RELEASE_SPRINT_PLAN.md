# UCell V1.1–V1.3 Sprint Plan
Status: PLANNING BASELINE — DO NOT START until Gate 0 approval
Date: 2026-09-16

Assumption: one primary Codex engineering stream with SA review; parallelization allowed only with file/domain ownership. Sprint duration is planning unit, not a calendar promise.

## Gate 0 — Current RC closure
Owner: current Core Codex. Exit: approved R1.0B Core checkpoint, replay/carry/release obligations at accepted state, next-release branch cut from verified integration checkpoint. No next-release schema migration before Gate 0 unless separately authorized.

## Sprint 1 — Foundations / contracts
Deliver: feature branch, schema stubs/migrations for consent/provider identity/OTP/referral attribution/AnalyticsEvent where approved; event envelope; privacy logging guard; OpenAPI skeleton; test fixtures. No KYC document bytes yet.
Acceptance: migrate from zero; build; event idempotency; no monetary regression.

## Sprint 2 — Network registration
Deliver contract consent + OTP + network profile + LINE/Google-compatible identity + zero-Qualification access.
Acceptance: end-to-end registration Golden; duplicate/race/expiry; BOLA; consent immutability.

## Sprint 3 — Formal member/KYC
Deliver formal application, protected documents, bank identity, Admin review, membership state transition.
Acceptance: document security/RBAC, concurrent approve, rollback, bank history, no Sponsor/Binary mutation.

## Sprint 4 — Delivery profile + formal workflow integration
Deliver checkout profile completion and formal-member prerequisite integration where required.
Acceptance: Network member can buy with completed delivery data; formal upgrade remains separate; existing Core order price/ownership untouched.

## Sprint 5 — Referral attribution
Deliver signed referral links, landing, anonymous tracking, 30-day lock/replacement, Person binding, history, LIFF state bridge.
Acceptance: exact time-boundary/concurrency/tamper tests; Sponsor immutability.

## Sprint 6 — System assignment
Blocked until Product Decision. Deliver versioned policy and deterministic system-ball+BFS placement.
Acceptance: concurrent placements, deterministic tie-break, audit/policy hash, no silent random behavior.

## Sprint 7 — CMS/share
Deliver Admin content/version/publish and Member view/share.
Acceptance: audience/window/private media, event tracking, responsive UI.

## Sprint 8 — Activities
Deliver activity CRUD/publish, registration/cancel/waitlist/check-in-ready Admin flow.
Acceptance: last-seat race, idempotency, history, audience authorization.

## Sprint 9 — Inbox/announcements
Deliver publication/audience snapshot/delivery/read/action.
Acceptance: audience isolation, exactly-once first-read evidence, publication audit. LINE push remains optional future channel.

## Sprint 10 — Analytics projection foundation
Deliver projector/checkpoints, MetricDefinition, replay/rebuild, asOf/status contracts.
Acceptance: duplicate/out-of-order events, deterministic rebuild, stale/partial semantics, Core reconciliation framework.

## Sprint 11 — NASL
Blocked on NASL definition approval. Deliver current/transition/cohort/reactivation/churn.
Acceptance: policy version, timezone, Person/Qualification separation, cohort reconciliation.

## Sprint 12 — Sponsor Sonar
Deliver 1–12 generation Sponsor projection, filters/drill-down.
Acceptance: Sponsor-only traversal, depth boundary, performance, RBAC.

## Sprint 13 — Binary Sonar
Deliver left/right + 1–12 Binary projection, volume/carry/balance.
Acceptance: Binary-only traversal, Core volume reconciliation, unavailable missing evidence.

## Sprint 14 — Growth analytics
Deliver referral/content/activity/message funnels and exception trends.
Acceptance: event-time attribution, no retroactive conversion rewrite, bounded filters/export controls.

## Sprint 15 — Health / Operations brief / hardening
Blocked on policy weights/thresholds. Deliver explainable health score, heat labels, daily operations brief, performance/security/UAT hardening.
Acceptance: component explanation, versioned policy, cannot influence bonus/rank, workload tests, accessibility, final UAT.

## Parallelization rules
Identity/KYC and Growth may become separate branches only after shared event/data contract freeze. Analytics implementation waits for event contract and sufficient source history. No two agents modify Prisma schema concurrently without a designated schema owner. Core monetary modules remain owned by Core stream.

## Every sprint evidence
REPORT, changed-file inventory, commit SHA, migrations, OpenAPI, tests, DB Golden, security matrix, unresolved decisions, screenshots for UI, performance evidence where relevant, PASS/BLOCKED matrix. No Production claim from synthetic credentials.
