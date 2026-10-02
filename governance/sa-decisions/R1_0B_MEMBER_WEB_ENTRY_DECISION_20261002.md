# UCell R1.0B Member Web Entry Decision — 2026-10-02

> 2026-10-03 alignment note: the LINE-only authentication restriction below is superseded by `R1_0B_WEB_MEMBER_MULTI_AUTH_DECISION_20261002.md`. Other entry/identity boundaries remain applicable unless expressly superseded. Approved multi-auth capability is not deployment evidence.

Status: PRODUCT OWNER APPROVED RELEASE-SCOPE CLARIFICATION
Baseline: R1.0B
Target: Sunday 2026-10-04 UAT / Production Go-No-Go

## 1. Decision

R1.0B Member access SHALL support two entry paths:

1. Existing LINE OA / LIFF entry.
2. Direct Web entry through the public Member Web URL.

For the current release scope, both entry paths use LINE as the same enabled authentication provider and converge on the same opaque UCell Member session, Person identity, memberNo, Qualification/Ball ownership and Member application.

This decision does NOT create a second member identity system.

## 2. Existing LINE OA behavior

The existing Stage LINE OA / LIFF behavior must remain unchanged:
- LINE OA / LIFF initializes LINE authentication.
- Backend verifies the LINE ID token.
- LINE ProviderIdentity resolves to Person.
- Backend issues an opaque UCell Member session.
- Qualification/Ball access remains server-authorized.

No current R1.0B compensation rule changes are introduced.

## 3. Direct Web behavior

A user may open the public Member Web URL from a normal browser.

If a valid opaque UCell Member session is already present, the frontend validates it through the authoritative Member API and resumes the same Member account.

If no valid Member session exists, the Web entry displays an explicit login screen. The user may choose LINE Login. The verified LINE credential is exchanged through the same Backend Member authentication path and yields the same UCell Member session model used by LINE OA / LIFF.

The direct Web entry must not automatically create another Person, memberNo, Qualification or Ball.

## 4. Explicit non-goals for this release

The following are NOT introduced before Sunday UAT unless separately approved:
- Member password authentication.
- SMS OTP Member login.
- Google OIDC Member login.
- A separate Web-only Member account.
- A separate Web Member application codebase.
- Any change to R1.0B monetary/economic semantics.

Existing dormant OTP/provider architecture remains available for a future reviewed authentication release.

## 5. Security invariants

- Client LINE profile data is never identity proof.
- Backend token verification remains authoritative.
- Raw LINE ID tokens are not persisted as Member credentials.
- UCell Member sessions remain opaque, expiry-controlled and revocable.
- QualificationAccessService / equivalent server authorization remains required.
- Admin credentials are never accepted as Member authentication.
- BOLA/IDOR boundaries remain unchanged.
- Referral attribution remains separate from authentication and Sponsor semantics.

## 6. UI / routing

The frontend SHALL separate entry-channel bootstrap from the Member application:
- LINE/LIFF entry -> authentication/session -> MemberApp.
- Direct Web entry -> login/session -> MemberApp.

After authentication both paths use the same QualificationProvider, routes, views, commerce, organization, bonus and profile components.

Dark/Light contrast rules apply to the Web entry surface.

## 7. Configuration

Before Production promotion, configure and verify:
- Member public Web origin.
- Production API base URL.
- LINE Login / LIFF allowed callback and redirect URLs.
- HTTPS-only Production origins.
- CORS / session transport policy.
- No secrets committed to Git.

## 8. UAT acceptance

Sunday UAT must verify:
- LINE OA flow unchanged.
- Direct Web URL opens in a normal browser.
- Explicit Web LINE login succeeds.
- OA and Web resolve to the same Person/memberNo/Balls.
- No duplicate identity/Qualification creation.
- Ball switching works.
- Session expiry/reconnect/logout works.
- Referral and deep links continue to work.
- Member authorization remains server-side.
- Dark and Light themes are readable.
- Mobile and desktop browser smoke pass.

## 9. Governance relationship

This clarification supersedes only the prior assumption that direct Web Member entry is deferred. It does NOT enable SMS OTP Login, Google OIDC Login or account-provider linking.

The prior multi-provider architecture remains valid. LINE remains the only enabled Member authentication provider for this release.

Any later independent Web credential requires a separate reviewed decision and implementation.

