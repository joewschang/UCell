# UCell V1.3 Analytics & 12-Generation Sonar — Detailed Specification
Status: DESIGN FREEZE CANDIDATE.
Date: 2026-09-16

## 1. Principle
Analytics is derived/read-only. Core monetary and organization facts remain authoritative. Missing data is UNAVAILABLE, never zero/synthetic. Person NASL and Qualification Active are separate dimensions.

## 2. AnalyticsEvent
Append-only event envelope: eventId, eventType, occurredAt, ingestedAt, personId?, qualificationId?, anonymousId?, sessionId?, referralAttributionId?, referralCode?, contentId?, contentVersionId?, campaignId?, activityId?, messagePublicationId?, orderId?, productId?, source, channel, metadata, schemaVersion. Never duplicate national ID/bank/document PII.

## 3. Read model refresh
Use event/outbox-driven projections where practical, with replayable projector checkpoints and projection version. Read models can be rebuilt from authoritative facts/events. Dashboard API must expose asOf, projectionVersion and unavailable/partial status.

## 4. NASL
NASL definitions are versioned policy. Provide Person NASL view and separate Qualification operational view.
Read models:
- NaslCurrentSnapshot(period/asOf, N/A/S/L counts/rates)
- NaslTransition(period, fromState, toState, count)
- NaslCohort(joinCohort, ageMonth, retained/active/suspend/lost counts/rates)
- Reactivation/Churn trends
Filters: date range, join cohort, referral source, content/campaign/activity source, lawful geography, product/first-order cohort. Never use protected/sensitive attributes for segmentation unless explicitly lawful/approved.

## 5. 12-generation Sponsor Sonar
Scope = selected root Qualification + historical/effective Sponsor Tree. For generation 1..12: qualificationCount, newCount, activeCount/rate, suspend/lost analytical counts, repurchaseCount/rate, PV/RPV/EPV authoritative aggregates, permitted bonus summary, engagement metrics. Drill-down returns contributing Qualification IDs under authorization.

## 6. 12-generation Binary Sonar
Scope = selected root Qualification + Binary Tree. Expose generation metrics plus LEFT/RIGHT summaries: member/Qualification count, Active rate, new/suspend indicators, authoritative volume, carry and balance ratio where Core evidence exists. Never derive Sponsor metrics from Binary edges.

## 7. Heat labels
Versioned deterministic SonarThresholdPolicy. Example categories GROWING/HOT/WATCH/COOLING/COLD/CRITICAL, but exact thresholds remain configurable. Every label response includes reason metrics and policyVersion. No black-box AI classification in V1.3.

## 8. Organization Health Index
Optional explainable index with default design weights: Active 25, Repurchase 20, New Growth 15, Suspend/Lost Risk 15, Binary Balance 10, Depth Activity 10, Engagement 5. Store scoreVersion, component scores and inputs. It is not a bonus/rank/Qualification input.

## 9. Dashboard contracts
A. Operations overview: NASL, orders/GMV read-only Core aggregate, repurchase, organization alerts, settlement/security exceptions.
B. NASL trend: period x N/A/S/L counts/rates.
C. NASL transitions: from->to counts and conversion/churn rates.
D. Cohort retention heatmap: join cohort x age month.
E. Sonar generation Active: generation 1..12 x active rate/count.
F. Sonar generation volumes: generation 1..12 x PV/RPV/EPV (compatible units only; UI may split charts if scales differ).
G. Binary health: left/right active, volume, carry, growth, imbalance.
H. Referral funnel: share/link created -> click -> OA -> registration -> formal member -> first paid order.
I. Content funnel: view -> share -> referral click -> registration/formal conversion.
J. Activity funnel: view -> registration -> check-in -> formal membership/first order where attributable.
K. Message funnel: delivered -> read -> click -> action.
L. Exception trend: returns/recovery/settlement/security/payment failures by period.

## 10. Metric definitions
Every metric has MetricDefinition: metricId, version, numerator, denominator, source facts/events, time grain, timezone, inclusion/exclusion, null/unavailable semantics. UI cannot invent formulas. Percentage denominator=0 returns null/unavailable, not 0% unless definition explicitly says so.

## 11. Attribution reporting
Referral conversion uses the valid attribution chain captured at event time. Report first-touch/current-at-conversion separately where needed. Never change historical conversion because the Person later clicks another referral after the 30-day window.

## 12. APIs
GET /api/v1/admin/analytics/overview
GET /api/v1/admin/analytics/nasl/current
GET /api/v1/admin/analytics/nasl/transitions
GET /api/v1/admin/analytics/nasl/cohorts
GET /api/v1/admin/analytics/sonar/sponsor/:qualificationId
GET /api/v1/admin/analytics/sonar/binary/:qualificationId
GET /api/v1/admin/analytics/referrals/funnel
GET /api/v1/admin/analytics/content
GET /api/v1/admin/analytics/activities
GET /api/v1/admin/analytics/messages
GET /api/v1/admin/analytics/exceptions
All endpoints enforce Admin RBAC and bounded date/filter limits.

## 13. Performance
Use projection/read-model tables, not recursive live scans for every dashboard request. Precompute generation paths/materialized projection as appropriate while retaining rebuildability. Index rootQualification, generation, period, state, source IDs. Define freshness SLO and expose asOf.

## 14. Privacy/security
Analytics roles may differ from KYC/Finance. Mask identifiers in exports, audit exports, bound result sizes, prevent arbitrary PII query. Sonar drill-down obeys organization/admin authorization.

## 15. Validation
Projection rebuild determinism; late/out-of-order event handling; duplicate event idempotency; timezone boundaries; Person-vs-Qualification separation; Sponsor-vs-Binary separation; 12-generation boundary; attribution 30-day boundary; denominator-zero; stale projection; RBAC/export; authoritative Core aggregate reconciliation.

## 16. Pending decisions
Exact NASL state definitions/transition thresholds; Sonar heat thresholds; Organization Health weights final approval; dashboard freshness SLO; analytics retention/export policy.