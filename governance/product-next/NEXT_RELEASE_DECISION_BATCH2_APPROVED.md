# UCell Next Release Decision Register — Batch 2 Approved Baseline
Status: APPROVED DESIGN BASELINE per Product Owner instruction to proceed with SA recommendations
Date: 2026-09-16
Scope: V1.1–V1.3 only; legal-specific retention periods remain subject to verified applicable obligations.

## NR-DEC-010 KYC data/document minimization — APPROVED PRINCIPLE
Formal Member onboarding collects only data/documents required by applicable participation, identity, payout and operational obligations. Network Member does not upload ID/bankbook by default. Formal KYC supports required ID evidence and bankbook-cover evidence, stored private/encrypted with metadata and access audit. No public URL. OCR may assist future extraction but never auto-approves identity absent separately approved verification policy.

Retention is class-based and versioned (`RetentionPolicyVersion`, `RetentionClass`, legalBasis, retainUntil/reviewAt, deletion/suspension action). Do not hardcode one universal retention period. Legal/accounting/MLM obligations must be mapped before Production deletion schedules are activated.

## NR-DEC-011 Bank verification — APPROVED MVP POLICY
MVP bank verification uses authoritative bank master/code validation, account-format validation where available, account-holder consistency check against Formal Member identity, bankbook-cover evidence and authorized manual review. Statuses distinguish PROVIDED, REVIEWED, VERIFIED_BY_PROVIDER (future), REJECTED; manual evidence review must not be labeled bank/provider verification. Historical payout bank snapshot/reference is immutable. Architecture retains provider interface for future bank API verification.

## NR-DEC-006 Sonar heat policy — APPROVED INITIAL VERSION
Use deterministic multi-metric policy, versioned and explainable. Initial baseline:
HOT: ActiveRate >=75% AND RepurchaseRate >=65% with no material negative trend.
WATCH: ActiveRate 55–74.99% unless another risk rule escalates.
COOLING: ActiveRate 40–54.99% OR material negative trend under policy.
COLD: ActiveRate <40%.
CRITICAL: ActiveRate <30% AND elevated Suspend/Lost risk under policy.
GROWING is an orthogonal positive flag when versioned New/Repurchase trend improvement threshold is met; it need not replace heat state.
Thresholds may be recalibrated prospectively after real-data calibration; historical output retains policyVersion.

## NR-DEC-007 Organization Health Index — APPROVED V1
Analytics-only weights: Active 25%, Repurchase 20%, New Growth 15%, Suspend/Lost Risk 15%, Binary Balance 10%, Depth Activity 10%, Engagement 5%. Store component values, normalization method, policyVersion and total. Score/label can never alter rank, Qualification, Active, bonus, carry, settlement or payout.

## NR-DEC-012 Analytics freshness — APPROVED INITIAL SLO
Operational analytics target projection lag <=15 minutes in normal operation. APIs expose `asOf`, `projectionVersion`, `status` and lag where useful. Lag breach marks STALE/PARTIAL and triggers operational alert; UI must not imply real-time freshness. Monetary/settlement screens continue to use authoritative Core read models and their own evidence semantics.

## NR-DEC-013 Analytics retention/export — APPROVED PRINCIPLE
Analytics uses data minimization. Raw event retention is controlled by versioned retention policy; aggregates may have longer retention if lawful/necessary. AnalyticsEvent must not contain national ID, full bank data or KYC document bytes. Export requires separate ANALYTICS_EXPORT permission, masking, bounded rows/date ranges, purpose/audit evidence and generated-file expiry. Exact legal retention durations remain configuration pending verified obligations.

## NR-DEC-014 Message audience governance — APPROVED V1
Audience selectors are server-owned definitions and resolve to immutable publication snapshots. OPERATIONS can publish ordinary content/activity/operational announcements. Financial, compliance, KYC or security-sensitive messages require a stricter permission/approval class. Arbitrary client-supplied recipient lists are not trusted as authorization. Publication and audience resolution are audited.

## NR-DEC-015 LINE push — APPROVED ARCHITECTURE / POST-MVP CHANNEL
Canonical truth is UCell Inbox/MessageDelivery. LINE push is a delivery adapter referencing the canonical publication/delivery. Push failure does not remove inbox delivery; retries are idempotent; opt-out/channel policy is separate. Initial V1.2 can ship without push if credentials/governance are not ready.

## NR-DEC-016 Activities payment boundary — APPROVED V1.2
V1.2 Activity registration is free by default. Paid activity is out of scope until separate Order/Payment/Refund/invoice/cancellation rules are approved. Do not silently reuse product order monetary semantics for event fees.

## Security incident baseline
Maintain SecurityIncident with detectedAt, incidentType, affectedDataClasses, scope, containment, notification assessment, authority/customer notification evidence, resolvedAt and audit trail. Regulatory notification deadlines are policy/configuration backed by verified legal baseline, not a magic UI timer without legal owner review.

## Remaining Production prerequisites
- Select/configure SMS provider account and credentials.
- Verify exact KYC/legal/accounting retention schedule and privacy notices.
- Define exact ID document requirements and any age/legal-capacity participation policy.
- Configure bank master source and manual-review SOP.
- Calibrate NASL/Sonar/Health policies against real UAT/early operational data before relying on them for management intervention.
- Define analytics export retention/file deletion and operational owners.

These do not alter current R1.0B monetary semantics and block only affected next-release Production paths.