# UCell V1.2 Growth Platform — Detailed Specification
Status: DESIGN FREEZE CANDIDATE.
Date: 2026-09-16

## 1. Modules
Referral Attribution, Share Links, CMS/Content, Campaign source tracking, Activities/Registration, Member Inbox/Announcements. Growth never calculates monetary truth.

## 2. Referral link
ReferralLink: id/tokenHash, referrerQualificationId, contentId?, campaignId?, activityId?, createdAt, expiresAt?, status. Public token is opaque/signed; do not expose mutable Sponsor authority in a plain query ID. Resolve endpoint validates token/referrer and records a touch.

## 3. 30-day attribution
ReferralAttribution is current provisional state; ReferralAttributionHistory is append-only. A valid touch when no active attribution creates attribution with lockedUntil=touch+30 days. During lock, later competing touches are recorded but do not replace. After expiry, a later valid competing touch may replace and starts a new 30-day window. Same-referrer touches may update lastTouchAt without extending the lockedUntil unless a future approved policy explicitly changes this.

Once Sponsor history is created for a Qualification, referral attribution can remain for analytics but cannot rewrite Sponsor.

## 4. Anonymous -> Person merge
Use anonymousId/sessionId before login. At authenticated registration, server links eligible attribution to Person with conflict checks. Never merge two Persons because they share device/cookie. Signed state survives Web -> LINE OA/LIFF transition.

## 5. SYSTEM_ASSIGNMENT
Only when Qualification workflow needs Sponsor and no valid attributed referral exists. Select from approved eligible system-ball pool and BFS/level-order placement. Required versioned policy: pool selector, tie-break, max/capacity, exclusion, effective window, locking strategy and policy hash. Must be deterministic and concurrency safe. Exact policy remains Pending Decision.

## 6. CMS
Content types VIDEO, ARTICLE/IMAGE, EXTERNAL_LINK. ContentVersion supports title, summary/body, media/object reference, external URL, thumbnail, audience, shareability, publish window, approval state, tags. Published version is immutable for analytics attribution; edits create version/evidence where material.

## 7. Share
Member Share action requests a server-generated share URL containing referral/source state. Record REFERRAL_LINK_CREATED and CONTENT_SHARED. Landing records click before routing. Sharing never grants Sponsor ownership without later validated conversion.

## 8. Activities
Activity: title, description, venue/online URL, start/end, registration window, capacity, waitlist policy, audience, organizer, status, content refs. ActivityRegistration: Person, optional Qualification context if explicitly required, status REGISTERED/WAITLISTED/CANCELLED/CHECKED_IN, idempotency key and timestamps. Preserve state history. Capacity changes and concurrent registration require transaction-safe enforcement.

## 9. Inbox
MessagePublication: category, title/body/link, audience selector snapshot, publish window, sender, approval/audit. MessageDelivery: publication+Person unique delivery. MessageReadEvidence and MessageActionEvidence append-only. Canonical inbox is UCell persisted state. LINE push/email/SMS are future delivery channels and do not replace inbox truth.

## 10. Audience governance
Initial selectors may include all network members, formal members, specific Persons, Qualification/rank/status segments, event registrants and explicit saved segment IDs. Audience resolution must be snapshotted/auditable for sent publications. Sensitive or monetary targeting requires stricter role permission.

## 11. Suggested APIs
GET /r/:token (landing/resolve)
POST /api/v1/member/share-links
GET /api/v1/member/content
GET /api/v1/member/content/:id
POST /api/v1/member/content/:id/share
GET /api/v1/member/activities
GET /api/v1/member/activities/:id
POST /api/v1/member/activities/:id/register
POST /api/v1/member/activities/:id/cancel
GET /api/v1/member/inbox
PATCH /api/v1/member/inbox/:id/read
POST /api/v1/admin/content
PATCH /api/v1/admin/content/:id
POST /api/v1/admin/content/:id/publish
POST /api/v1/admin/activities
PATCH /api/v1/admin/activities/:id
GET /api/v1/admin/activities/:id/registrations
POST /api/v1/admin/messages
POST /api/v1/admin/messages/:id/publish

## 12. Events
Emit append-only AnalyticsEvent for referral link created/clicked, OA opened where server evidence exists, content view/share/click, activity view/register/cancel/check-in, message delivered/read/click/action. Do not infer events client-side if server confirmation is required.

## 13. Tests
30-day boundary, competing referrers, expired replacement, same-referrer touch, anonymous->Person binding, token tamper/expiry, invalid/suspended referrer policy, Sponsor immutability, system-assignment concurrency, content publish windows, private media authorization, activity capacity races/waitlist, duplicate registration/cancel, message audience isolation, BOLA/IDOR, publication idempotency.

## 14. Pending decisions
SYSTEM_ASSIGNMENT policy; message audience governance; future LINE push policy; paid-event cancellation/refund rules if paid activities are introduced.