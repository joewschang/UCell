# UCell Next Release Engineering Contract
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-16

This document converts V1.1–V1.3 product design into engineering contracts. It does not authorize implementation before current R1.0B Core Closure reaches its approved checkpoint.

## A. Data model groups
Identity/Compliance: PersonMembershipState, ProviderIdentity, ContractDocumentVersion, ConsentEvidence, OTPChallenge, DeliveryProfile, FormalMemberApplication, FormalMemberApplicationSnapshot, KycDocument, KycReviewEvidence, BankAccountIdentity.
Growth: ReferralLink, ReferralAttribution, ReferralAttributionHistory, SystemAssignmentPolicy, Content, ContentVersion, Activity, ActivityRegistration, ActivityRegistrationHistory, MessagePublication, MessageAudienceSnapshot, MessageDelivery, MessageReadEvidence, MessageActionEvidence.
Analytics: AnalyticsEvent, AnalyticsProjectionCheckpoint, MetricDefinition, NaslPolicyVersion, NaslCurrentSnapshot, NaslTransition, NaslCohort, SonarThresholdPolicy, SponsorSonarProjection, BinarySonarProjection, OrganizationHealthPolicy, OrganizationHealthSnapshot.

All mutable business configuration uses version/effectiveFrom/effectiveTo/hash/approval reference where applicable. Historical evidence is append-only.

## B. Key relational constraints
ProviderIdentity unique(provider, issuer, subject). ConsentEvidence unique(Person, ContractVersion) unless contract explicitly allows repeated evidence. MessageDelivery unique(Publication, Person). AnalyticsEvent unique(eventId). ActivityRegistration prevents multiple simultaneously active registrations per Person/Activity. Referral attribution history never updates old rows. KycDocument belongs to one FormalMemberApplication. Bank identity history uses half-open effective intervals. Sponsor/Binary histories remain Core-owned.

## C. API envelope
All APIs use existing UCell response/error conventions, bearer/session guards and server-side ownership. Mutations susceptible to redelivery require Idempotency-Key. List APIs use bounded pagination, deterministic ordering and filter validation. Sensitive endpoints never echo full national ID/bank account in ordinary list responses.

## D. Event catalog
Identity: NETWORK_MEMBER_REGISTERED, OTP_CHALLENGE_CREATED, MOBILE_VERIFIED, CONTRACT_CONSENTED, FORMAL_APPLICATION_SUBMITTED, FORMAL_APPLICATION_NEEDS_INFO, FORMAL_APPLICATION_APPROVED, FORMAL_APPLICATION_REJECTED, PROVIDER_IDENTITY_LINKED, BANK_IDENTITY_CHANGED.
Growth: REFERRAL_LINK_CREATED, REFERRAL_LINK_CLICKED, REFERRAL_ATTRIBUTION_CREATED, REFERRAL_ATTRIBUTION_REPLACED, CONTENT_VIEWED, CONTENT_SHARED, CONTENT_CLICKED, ACTIVITY_VIEWED, ACTIVITY_REGISTERED, ACTIVITY_WAITLISTED, ACTIVITY_CANCELLED, ACTIVITY_CHECKED_IN, MESSAGE_PUBLISHED, MESSAGE_DELIVERED, MESSAGE_READ, MESSAGE_CLICKED.
Commerce references: ORDER_CREATED, ORDER_PAID, REPURCHASE_COMPLETED are consumed from authoritative Core/outbox evidence; Analytics does not recreate monetary facts.

Every event has eventId, schemaVersion, occurredAt, actor/source, correlationId and applicable entity IDs. Sensitive values are excluded from event payloads.

## E. State machines
Person membership: NETWORK_MEMBER -> FORMAL_PENDING -> FORMAL_MEMBER; rejection/withdrawal returns to NETWORK_MEMBER with immutable application history.
KYC: DRAFT -> SUBMITTED -> UNDER_REVIEW -> NEEDS_MORE_INFO -> SUBMITTED or APPROVED/REJECTED.
Activity registration: REGISTERED/WAITLISTED -> CHECKED_IN or CANCELLED, with append-only transition evidence.
Referral attribution: ACTIVE_LOCKED -> EXPIRED -> REPLACED/INACTIVE; a new valid touch after expiry creates/replaces current attribution while history remains.
Content: DRAFT -> REVIEW -> SCHEDULED/PUBLISHED -> ARCHIVED, versioned.
Message publication: DRAFT -> SCHEDULED/PUBLISHED -> CLOSED/CANCELLED; deliveries remain historical.

## F. RBAC baseline
MEMBER: own profile, consents, KYC application/documents, content/activity/inbox/share.
MEMBER_SERVICE: masked Person/network/formal status and operational support; no unrestricted document/bank unmask.
KYC_REVIEWER: review KYC and authorized document access; cannot modify monetary Core.
OPERATIONS: content/activity/message operations, organization/read analytics according to policy.
FINANCE: bank/payout-related authorized reads and payout functions; not KYC document administrator by default.
ANALYTICS: aggregated/read-model analytics and controlled exports; no KYC documents or full bank/national ID.
AUDITOR: read evidence/audit according to policy, no mutation.
SUPER_ADMIN: exceptional administration but all sensitive access audited; production break-glass should be separately governed.

Exact Entra role mapping remains environment configuration.

## G. Referral attribution acceptance rules
30-day lock boundary is server time under approved operational timezone. Competing referral during lock cannot replace. First valid competing touch after expiry can replace. Same-referrer touch does not extend lock by default. Attribution replacement cannot modify an existing Sponsor relationship. Anonymous-to-Person linking is explicit and conflict-safe.

## H. System assignment acceptance rules
No valid referral at Qualification Sponsor-conversion time -> evaluate versioned SystemAssignmentPolicy. Selection and BFS placement must be deterministic, concurrency-safe and audited. Never silently randomize. Exact eligible system-ball pool/tie-break/capacity remain Pending Decision.

## I. Analytics acceptance rules
Read model output contains asOf/projectionVersion/status. Missing source facts => UNAVAILABLE/PARTIAL, not zero. Metric formulas come from MetricDefinition. Person NASL never substitutes Qualification Active. Sponsor Sonar and Binary Sonar use their own trees. Generation depth stops at 12. Monetary aggregates reconcile to Core authoritative read models.

## J. Non-functional targets for implementation planning
Security: least privilege, encryption, private object storage, PII masking, audit, no PII in telemetry/referral URL.
Reliability: idempotent mutations, outbox/event redelivery, deterministic projections, concurrency tests.
Performance: analytics projection tables; bounded dashboard queries; no unbounded recursive tree scan per request.
Observability: correlationId, structured non-PII logs, metrics for OTP/KYC/referral/activity/inbox/projector failures.

## K. Implementation gates
Gate 0 current R1.0B Core Closure checkpoint approved.
Gate 1 schema/API/event contract review.
Gate 2 V1.1 implementation + security tests + UAT.
Gate 3 V1.2 implementation + attribution/concurrency tests + UAT.
Gate 4 V1.3 projection reconciliation/performance/RBAC + UAT.
No gate permits changing frozen R1.0B monetary semantics.
