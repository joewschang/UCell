# UCell Next Release API / Event / RBAC Matrix
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-17

## API conventions
Existing UCell envelope/auth/error conventions apply. Current member authentication is LINE OA/LIFF. Mutations use Idempotency-Key where redelivery is plausible. IDs opaque; sensitive list responses masked. 409 for placement/idempotency conflict, 403 role/ownership denial, 404 non-disclosure where policy requires, 422 for valid request blocked by missing evidence/configuration.

## Member registration / formal application
Network registration occurs inside authenticated LINE session; no mobileChallengeId required in current channel. Collect required basic/contact fields + contract/privacy evidence. Future OTP/Google endpoints remain feature-disabled.
Formal application APIs remain protected for data/KYC/document submission and Admin review. KYC approval alone does not create FORMAL_MEMBER without qualifying package purchase evidence.

## Membership package / Ball setup APIs
GET /api/v1/member/membership-packages -> authoritative eligible 啟航/菁英/領袖 package profiles.
POST /api/v1/member/membership-qualifications -> initiate qualifying purchase/setup context after authoritative order flow.
GET /api/v1/member/qualifications/:id/setup -> setup state, attribution prefill, sponsor selection, placement status/dueAt.
PATCH /api/v1/member/qualifications/:id/sponsor -> member selects/changes final Sponsor Ball before Sponsor confirmation; request sponsorQualificationId; response validated sponsor owner + selection evidence.
POST /api/v1/member/qualifications/:id/sponsor/confirm -> freezes final Sponsor selection / creates applicable Sponsor history under Core transaction.
GET /api/v1/member/placements/pending -> Balls for which current Person owns Sponsor Ball and has placement authority.
GET /api/v1/member/qualifications/:id/placement-options -> authorized legal Binary candidates/read model; not authoritative until commit.
POST /api/v1/member/qualifications/:id/place -> binaryParentQualificationId, side; Backend revalidates authorization/slot/cycles and atomically places.

For Ball #2+, sponsorQualificationId may reference another eligible Ball owned by current Person. This never changes Person-level referrer.

## Admin placement APIs
GET /api/v1/admin/qualification-placements?status=&aging= -> Placement Monitor.
GET /api/v1/admin/qualification-placements/:qualificationId -> Sponsor/new Ball/aging/audit/legal option context.
POST /api/v1/admin/qualification-placements/:qualificationId/place -> requires QUALIFICATION_PLACEMENT_OVERRIDE; request binaryParentQualificationId,side,reasonCode,note?; same Core legality/concurrency validation.
POST /api/v1/admin/qualification-placements/:qualificationId/assign-reviewer optional operational workflow.

## Referral APIs
GET /r/:token validates/records provisional attribution and returns signed LIFF transition state. It never fixes final Sponsor authority.
POST /member/share-links generates server share URL tied to Person and applicable/default referral Ball context.
ReferralAttribution response may expose safe referrer display context and referrerQualification code needed for prefill, subject to policy.

## Other V1.2/V1.3 APIs
Content/share, activities, inbox and analytics endpoints remain as previously defined. Analytics returns {asOf,projectionVersion,status,data} and never mutates organization/monetary truth.

## Event catalog additions/corrections
MEMBERSHIP_PACKAGE_PURCHASE_RECOGNIZED: personId,orderId,orderLineId?,packageType,qualificationId?; references Core authoritative order evidence.
FORMAL_MEMBERSHIP_ACTIVATED: personId,activationEvidenceId,qualifyingOrderId,firstQualificationId,finalSponsorQualificationId,referrerPersonId,ruleVersion.
QUALIFICATION_SETUP_CREATED: qualificationId,ownerPersonId,packageType,qualifyingOrderId.
QUALIFICATION_SPONSOR_PREFILLED: qualificationId,attributionId?,referrerPersonId?,referrerQualificationId?.
QUALIFICATION_SPONSOR_SELECTED: qualificationId,selectedSponsorQualificationId,selectedSponsorOwnerPersonId,source,policyVersion.
QUALIFICATION_SPONSOR_CONFIRMED: qualificationId,sponsorQualificationId,sponsorOwnerPersonId,confirmedAt.
QUALIFICATION_PLACEMENT_REQUESTED: qualificationId,sponsorQualificationId,requestedAt,dueAt.
QUALIFICATION_PLACEMENT_OVERDUE: qualificationId,dueAt,escalatedAt.
QUALIFICATION_PLACED: qualificationId,sponsorQualificationId,binaryParentQualificationId,side,placedByType,placedByPersonId?,policyVersion.
QUALIFICATION_ACTIVATED: qualificationId,effectiveAt,activationEvidenceRef.
SYSTEM_ASSIGNMENT_COMPLETED: qualificationId,systemSponsorQualificationId,binaryParentQualificationId,side,policyVersion.
MEMBER_REFERRER_ESTABLISHED: referredPersonId,referrerPersonId,firstQualificationId,sourceSponsorQualificationId,effectiveAt.

Referral events carry both referrerPersonId and referrerQualificationId when known. Analytics preserves provisional attribution and final Sponsor selection as separate facts.

## Placement RBAC
MEMBER: may select Sponsor for own unconfirmed Ball; may place a Ball only when member owns the confirmed Sponsor Ball and policy authorizes placement.
MEMBER_SERVICE: read masked placement status/support; no placement override by default.
OPERATIONS: Placement Monitor read; no override unless separately granted.
QUALIFICATION_PLACEMENT_OVERRIDE: privileged action permission for overdue/Admin placement; reason/audit mandatory.
AUDITOR: read placement/sponsor/referrer evidence, no mutation.
SUPER_ADMIN: exceptional/break-glass subject to audit.
Existing monetary Core roles unchanged.

## Authorization invariants
Selecting Sponsor for own Ball != authority to place arbitrary Ball. Placement authority derives from ownership of confirmed Sponsor Ball plus applicable permission. Sponsor Ball and Binary Parent differ. Person ownership equality across two different Balls is allowed for Ball #2+ sponsorship. Self-edge/cycles prohibited in Sponsor and Binary graphs independently.

## Concurrency contract
Placement commit locks/revalidates new Ball unplaced + target slot available + operator authorized + graphs legal. Competing placement returns 409 PLACEMENT_CONFLICT. Client-side placement-option list is advisory only.

## Contract tests
LINE session registration without OTP; qualifying package vs ordinary product; KYC-only cannot activate Formal Member; first Ball establishes Member Referrer; second Ball own-Ball sponsorship leaves Member Referrer unchanged; attribution prefill can be manually changed before confirmation; Sponsor confirmation immutability; Sponsor-owner placement authorization; 72h due/overdue; Admin override permission/audit; same-slot race; same-Ball double-place; Sponsor/Binary cycle prevention; SYSTEM_AUTO no-referral path; Person/Sponsor/Binary separation.