# UCell V1.1–V1.3 Product & System Specification

Status: DESIGN BASELINE — POST-MVP / NEXT RELEASE
Date: 2026-09-16
Authority: supplements R1.0B; MUST NOT alter frozen monetary semantics.

## 1. Release plan

### V1.1 Identity & Compliance
- Two account stages: NETWORK_MEMBER and FORMAL_MEMBER.
- Registration contract consent with immutable contract version/hash, consent timestamp and evidence.
- Network member required fields: legal/display name policy, alias, gender, date of birth, mobile, email.
- Formal member upgrade additionally requires national ID number, communication address, bank code/account/account holder, ID-document image(s), bankbook-cover image, verified mobile OTP and all required contract/KYC evidence.
- Network member checkout requires address and telephone before fulfillment; this does not itself make the person a Formal Member.
- Google OIDC-compatible third-party identity may be linked to Person, but never replaces Formal Member KYC or Qualification authorization.
- Sensitive documents are private objects; metadata in DB, bytes in protected object storage; no public URLs; audited authorized access only.

### V1.2 Growth Platform
- CMS supports video, image/article and external link records, publishing windows and sharing.
- Share URLs carry a referral token/code and optional content/campaign/event source.
- Referral attribution is separate from final Sponsor/Qualification creation.
- Activity/event announcements, registration, capacity/waitlist/check-in-ready model.
- Member message inbox; Admin may publish announcements/messages to defined audiences with immutable publication evidence.

### V1.3 Analytics & Sonar
- NASL lifecycle analytics.
- 12-generation Organization Sonar for Sponsor and Binary contexts.
- Referral/conversion funnel, content analytics, activity analytics, message analytics, commerce/repurchase trends and exception trends.
- Analytics is read-model/reporting only and MUST NOT calculate or mutate monetary truth.

## 2. Identity model
Person remains the identity root. Person != Qualification. Formal membership status is Person-level; Qualification/Ball remains 1:N and independent. Authentication identities (LINE, Google, future providers) map to Person through provider identity records. Contact fields never authorize ownership.

Suggested Person lifecycle extension: NETWORK_MEMBER -> FORMAL_PENDING -> FORMAL_MEMBER, with suspension/closure modeled independently from NASL analytical state where appropriate.

## 3. Registration and formal-member workflow
NETWORK_MEMBER registration:
1. display contract/version; record explicit consent;
2. collect required network fields;
3. verify mobile OTP according to configured risk policy;
4. create/link Person;
5. optionally link LINE/Google identity.

FORMAL_MEMBER upgrade:
1. require latest applicable contracts/consents;
2. collect formal fields;
3. upload ID/bankbook evidence;
4. OTP verified mobile;
5. validate bank/account-holder fields;
6. submit KYC application;
7. Admin review/approve/reject with reason and audit;
8. only after approval may formal-member-only Qualification workflow proceed.

Never store raw OTP. Store challenge hash/provider reference, destination fingerprint, expiry, attempts, verification timestamp and audit evidence. Add resend/rate-limit/lockout controls.

## 4. Referral attribution
Canonical model: ReferralAttribution + append-only ReferralAttributionHistory.

Fields include anonymousId/sessionId, personId?, referrerQualificationId, referralCode/token, firstTouchAt, lastTouchAt, lockedUntil, sourceContentId?, sourceCampaignId?, sourceActivityId?, status and replacement reason.

Policy baseline requested by Product Owner:
- a referral touch establishes attribution for 30 days;
- while within the active 30-day window, subsequent referral links do not replace the current attribution;
- after the window has expired, a subsequent valid referral link may replace attribution and starts a new 30-day window;
- every replacement is append-only/auditable;
- attribution does NOT retroactively rewrite an already-created Sponsor relationship or Qualification.

If no valid referral exists at the point a formal Qualification requires placement, invoke SYSTEM_ASSIGNMENT policy: choose an eligible system ball and perform deterministic breadth-first/level-order placement under the approved placement rules. The exact eligible system-ball pool, tie-breaker and concurrency locking MUST be versioned configuration and tested before Production.

## 5. LINE OA and share-link behavior
A shared URL resolves through UCell referral landing logic, records attribution, then may route/open LINE OA/LIFF. Attribution must survive the OA/LIFF transition through a signed opaque state/token; do not trust client query parameters as final Sponsor authority. Server validates referral token, expiry and referrer Qualification eligibility.

## 6. CMS / content
Content entity: id, type, title, summary, media/object reference or external URL, thumbnail, publish state/window, audience, share policy, createdBy/approvedBy, timestamps. Media access follows storage policy. Track views/shares/clicks using AnalyticsEvent. Do not fabricate conversion attribution without a valid ReferralAttribution chain.

## 7. Activities/events
Activity entity supports title, description, venue/online link, start/end, registration window, capacity, waitlist policy, audience, status and organizer. Registration is idempotent and Person-scoped; optionally Qualification-scoped only when explicitly required. Preserve registration/cancellation/check-in history. Activity announcements can create inbox messages.

## 8. Member inbox / announcements
MessagePublication defines content, audience selector, publish window and sender. MessageDelivery/ReadEvidence is append-only per recipient. Admin publication must be audited. Future LINE push is an outbound channel, not the canonical inbox truth. Read/click/action analytics are derived from persisted events.

## 9. Analytics event contract
Create append-only AnalyticsEvent with eventId, eventType, occurredAt, personId?, qualificationId?, anonymousId?, sessionId?, referralAttributionId?, referralCode?, contentId?, campaignId?, activityId?, messageId?, orderId?, productId?, source, channel and metadata.

Initial event vocabulary:
REFERRAL_LINK_CREATED, REFERRAL_LINK_CLICKED, OA_OPENED, REGISTRATION_STARTED, REGISTRATION_COMPLETED, FORMAL_MEMBER_SUBMITTED, FORMAL_MEMBER_APPROVED, CONTENT_VIEWED, CONTENT_SHARED, CONTENT_CLICKED, ACTIVITY_VIEWED, ACTIVITY_REGISTERED, ACTIVITY_CANCELLED, ACTIVITY_CHECKED_IN, MESSAGE_DELIVERED, MESSAGE_READ, MESSAGE_CLICKED, ORDER_CREATED, ORDER_PAID, REPURCHASE_COMPLETED.

Monetary events remain Core authoritative; AnalyticsEvent may reference them but never replaces/recomputes them.

## 10. NASL analytics
NASL = New / Active / Suspend / Lost. Maintain separate Person and Qualification views. Do not infer Qualification Active from Person NASL or vice versa.

Read models:
- current NASL counts/rates;
- NASL transition matrix by day/week/month;
- cohort retention by join month;
- reactivation and churn;
- dimensions: source/referrer/content/activity/product/region where lawful and available.

NASL definitions and transition thresholds MUST be versioned and explainable.

## 11. 12-generation Organization Sonar
Two explicit modes: Sponsor Sonar and Binary Sonar. Never mix trees.

For each generation 1..12, read models may expose total Qualifications, Active/Suspend/Lost, new joins, repurchase rate, PV/RPV/EPV authoritative aggregates, and permitted bonus summaries. Binary mode additionally exposes left/right counts, volumes, carry and balance indicators.

Hot/Cooling/Cold/Growing labels use deterministic versioned thresholds first; no opaque AI classification in V1.3. Drill-down must explain contributing metrics.

## 12. Organization Health Index
Optional V1.3 explainable score (versioned weights): Active Rate 25%, Repurchase Rate 20%, New Member Growth 15%, Suspend/Lost Risk 15%, Binary Balance 10%, Depth Activity 10%, Engagement 5%. This is an operational analytic score, never a Qualification/rank/bonus entitlement input unless a future approved rule explicitly says so.

## 13. Priority dashboards
1. NASL trend.
2. NASL transition/churn funnel.
3. Cohort retention heatmap.
4. Generation 1–12 Active rate.
5. Generation 1–12 PV/RPV/EPV.
6. Binary left/right health.
7. Referral share -> click -> OA -> registration -> formal member -> first order funnel.
8. Product sales/repurchase trend.
9. Activity exposure -> registration -> check-in -> membership/order funnel.
10. Content view -> share -> registration conversion.
11. Message delivered/read/click/action funnel.
12. Return/recovery/settlement/security exception trend.

All dashboard figures must come from authoritative read models. Missing data = unavailable, never synthetic Production data.

## 14. Security/privacy
National ID, bank details, DOB, address, phone, email and document images are sensitive. Apply field-level masking in Admin, least-privilege RBAC, encryption in transit/at rest, private object storage, short-lived signed access, access audit, retention/deletion policy, malware/content validation for uploads and environment-separated secrets. Analytics should minimize sensitive fields and use IDs/pseudonymous identifiers rather than duplicating PII.

## 15. Architecture boundaries
Core remains authority for Person/Qualification/Organization/Active/Rule/PV/BV/RPV/EPV/Bonus/Ledger/Settlement. Growth owns attribution/content/activity/inbox. Identity/KYC owns verification evidence and formal-member workflow. Analytics consumes append-only events/read models. ERP remains future inventory/accounting/fulfillment boundary. AI may analyze read models later but cannot mutate monetary truth.

## 16. Delivery sequencing
Current R1.0B Core Closure and Release Candidate work MUST NOT be interrupted.

Now: freeze this design and add tracking/event-compatible seams only where non-invasive.
After current RC Core closure: V1.1 Identity & Compliance.
Then V1.2 Growth Platform.
Then V1.3 Analytics & Sonar.

Critical early exception: AnalyticsEvent and ReferralAttribution contracts should be implemented at the beginning of V1.1/V1.2 so history exists before V1.3 dashboards.

## 17. Pending decisions before implementation freeze
- exact Taiwan identity/KYC legal/retention policy and whether third-party verification is required;
- SMS provider and OTP operational limits;
- bank master/source and account verification method;
- SYSTEM_ASSIGNMENT eligible system-ball pool, deterministic tie-break and capacity/locking policy;
- precise NASL definitions/transition thresholds;
- activity cancellation/refund rules if paid activities are later introduced;
- message audience governance and future LINE push policy.

These items fail closed only affected features; they must not alter R1.0B monetary rules.
