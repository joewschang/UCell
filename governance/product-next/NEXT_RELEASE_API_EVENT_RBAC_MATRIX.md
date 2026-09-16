# UCell Next Release API / Event / RBAC Matrix
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-16

## API contract conventions
Existing UCell envelope/auth/error conventions apply. Mutations use Idempotency-Key when repeat delivery is plausible. IDs are opaque. Dates are ISO timestamps with server-authoritative timezone semantics. Sensitive list responses are masked. Pagination bounded. 409 for idempotency/policy conflict where appropriate; 403 ownership/role denial; 404 non-disclosure for foreign sensitive object where policy requires; 422 valid request blocked by missing configuration/evidence.

## Key request/response contracts
POST /registration/network
Request: contractVersionId, consentProof, legal/display name fields, alias, gender, birthDate, mobileChallengeId, email, referralState?. Response: personId, membershipState, providerLinkOptions. Server validates verified OTP and referral state separately.

POST /auth/otp/challenges
Request: purpose,destination. Response: challengeId,expiresAt,resendAvailableAt; never OTP/provider secret.
POST /auth/otp/challenges/:id/verify Request: code. Response: verifiedAt/status.

GET /member/contracts/required -> contract version metadata/hash/required flag.
POST /member/contracts/:versionId/consent -> consent evidence id/timestamp.

GET/PATCH /member/delivery-profile -> masked/current delivery fields; mutation idempotent/audited.

POST /member/formal-applications -> application id/status.
POST /member/formal-applications/:id/documents -> upload-init or protected upload contract; response object/document reference, never public URL.
POST /member/formal-applications/:id/submit -> frozen snapshot hash/status.
GET /member/formal-applications/current -> masked status/checklist/reason codes.

Admin KYC list/detail never returns unmasked national ID/bank by default. Explicit privileged detail/document access endpoint/action is audited.

GET /r/:token -> validates token, records touch, returns safe redirect/LIFF state. Never exposes final Sponsor authority.
POST /member/share-links Request source refs; Response signed shareUrl/expiresAt/referralLinkId.

GET /member/content, /content/:id -> published audience-filtered version.
POST /member/content/:id/share -> server share URL + source evidence.

POST /member/activities/:id/register -> registration status including WAITLISTED; idempotent.
POST /member/activities/:id/cancel -> current status/evidence.

GET /member/inbox -> deliveries with read state.
PATCH /member/inbox/:id/read -> firstReadAt/current state.

Admin content/activity/message mutations require appropriate role and audit.

Analytics endpoints return {asOf,projectionVersion,status,data}. status FULL|PARTIAL|UNAVAILABLE. Filters are bounded and validated.
Sonar endpoints require rootQualificationId ownership/authorized Admin scope and explicit mode-specific DTOs.

## Event payload baseline
Common: eventId,schemaVersion,eventType,occurredAt,correlationId,actorType,actorId?,personId?,qualificationId?,source,channel.
NETWORK_MEMBER_REGISTERED: personId,membershipState,referralAttributionId? (no PII).
MOBILE_VERIFIED: personId?/registrationSessionId,purpose,destinationFingerprint.
CONTRACT_CONSENTED: personId,contractVersionId,contentHash.
FORMAL_APPLICATION_SUBMITTED/APPROVED/REJECTED: personId,applicationId,applicationVersion,reasonCode?; no document bytes/ID number.
REFERRAL_LINK_CLICKED: referralLinkId,anonymousId?,personId?,referrerQualificationId,contentVersionId?/campaignId?/activityId?.
REFERRAL_ATTRIBUTION_CREATED/REPLACED: attributionId,oldReferrerQualificationId?,newReferrerQualificationId,lockedUntil,reasonCode.
CONTENT_*: contentId/contentVersionId,referralAttributionId? where relevant.
ACTIVITY_*: activityId,registrationId?,personId,status.
MESSAGE_*: publicationId,deliveryId,personId,actionType?.
ORDER_CREATED/ORDER_PAID/REPURCHASE_COMPLETED: consume authoritative Core event identity/reference; do not synthesize amounts in Analytics.

## RBAC matrix (baseline)
Action | MEMBER | MEMBER_SERVICE | KYC_REVIEWER | OPERATIONS | FINANCE | ANALYTICS | AUDITOR | SUPER_ADMIN
Own profile/delivery | RW | masked support | R masked | R masked | - | - | audit R | exceptional
Own KYC submit/docs | RW own | status support | review R | - | payout-safe status only | - | evidence R policy | exceptional
Unmask KYC docs | - | - | explicit R audited | - | - | - | policy R | break-glass
Bank payout identity | own masked/RW via workflow | masked | holder-name check policy | - | explicit R | - | audit R | exceptional
Content/activity/message admin | R member | support R | - | RW | - | analytics R | audit R | exceptional
Referral/share | RW own | support R | - | campaign ops | - | aggregate R | audit R | exceptional
NASL/Sonar | own limited future | support limited | - | R | limited payout context | R aggregate/drill policy | R | R
Monetary Core mutation | existing Core rules only; none of these new roles gain rights by this document.

## Permission principles
Role alone is insufficient where object ownership/audience/organization scope applies. Sensitive unmask/document download is an explicit auditable action. Analytics export is separately permissioned. Production SUPER_ADMIN should use break-glass governance.

## Contract tests required
OpenAPI schemas; auth/role/ownership matrix; masked fields; idempotency; pagination/filter bounds; 30-day referral boundary; foreign object non-disclosure; document signed-access expiry; analytics FULL/PARTIAL/UNAVAILABLE; Person/Qualification and Sponsor/Binary separation.