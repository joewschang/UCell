# UCell R1.0B Web Member Multi-Authentication Decision — 2026-10-02

Status: PRODUCT OWNER APPROVED
Scope: R1.0B Web Member entry
Supersedes: LINE-only Web-entry limitation in R1_0B_MEMBER_WEB_ENTRY_DECISION_20261002.md

## 1. Decision

The UCell Web Member entry SHALL support multiple authentication methods while preserving the existing LINE OA / LIFF entry.

Enabled Web authentication targets:
1. LINE Login.
2. Google OIDC login.
3. Member Number + Password.
4. Mobile Number + OTP.

All successful methods SHALL resolve to the same authoritative Person, immutable memberNo, Qualification/Ball portfolio and opaque UCell Member session model.

No authentication provider may create a second business identity for the same linked Person without an explicit reviewed registration/linking flow.

## 2. Registration

The Web entry SHALL provide Network Member registration.

Registration requirements:
- applicable contract/privacy notice and immutable consent evidence;
- basic Network Member profile;
- at least one verified authentication method;
- referral transition retained when present;
- no Qualification/Ball created merely by account registration;
- duplicate provider/mobile/email conflicts fail closed or route to explicit linking/recovery.

Provider identity and Person remain separate concepts.

## 3. Google

Reuse IdentityProvider.GOOGLE and ProviderIdentity.

Google authentication must:
- verify Google-issued evidence server-side;
- validate issuer, audience/client ID, expiry and subject;
- map provider subject to one Person;
- never auto-merge Persons solely because email values match;
- persist no raw Google access/ID credential as a Member password/session;
- issue the standard opaque UCell Member session after successful resolution.

## 4. Local Member Password

memberNo is the public login identifier.

A dedicated Member credential record SHALL store only a strong password hash and credential metadata. It SHALL NOT reuse Admin-local credential structures.

Requirements:
- Argon2id preferred;
- plaintext/reversible password storage prohibited;
- rate limiting/backoff/lockout policy;
- audit evidence for create/change/reset;
- password change/reset revokes or rotates affected Member sessions according to policy;
- credential remains Person-scoped, never Ball-scoped.

## 5. Mobile OTP Login

The existing OTP domain SHALL be extended intentionally to support LOGIN while retaining ACCOUNT_RECOVERY and existing purposes.

Requirements:
- unique eligible Person resolution through normalized verified mobile evidence;
- raw OTP never stored or logged;
- expiry, attempt limit, resend cooldown and rate limits;
- replay-safe/single-consumption semantics;
- configured Stage/Production SMS provider required before capability is declared production-ready.

## 6. Forgot Password

The Web entry SHALL expose Forgot Password.

Approved flow:
1. User enters memberNo or email.
2. Server responds generically to prevent account enumeration.
3. If an eligible account/email exists, generate a cryptographically random reset token.
4. Persist only token hash, Person/credential reference, expiry and consumption state.
5. Email a HTTPS reset link.
6. Reset token is short-lived and single-use.
7. User sets a new password.
8. Password hash is updated, audit evidence appended and affected sessions revoked/rotated.

The system SHALL NEVER email a password, temporary plaintext password or reusable secret.

## 7. Common Session and Authorization

All authentication methods issue the same opaque UCell Member session.

All Member routes continue to use:
- MemberAuthenticationGuard or equivalent;
- server-side Person resolution;
- Qualification/Ball ownership checks;
- BOLA/IDOR controls;
- existing Member-safe privacy projections.

Authentication does not imply Qualification ownership, Sponsor relationship, Active status, rank or monetary rights.

## 8. Web UX

Web login shall expose:
- Continue with LINE
- Continue with Google
- Member Number + Password
- Mobile + OTP
- Register
- Forgot Password

Registration, login, OTP and password reset pages must support desktop/mobile and Light/Dark themes.

## 9. Release impact

This decision expands R1.0B Web authentication beyond the earlier LINE-only scope.

R1.0B economic rules are unchanged.

Production promotion requires provider/config/security/UAT evidence for every authentication method that is enabled in Production. An unconfigured provider must remain disabled rather than silently fallback.

## 10. Relationship to existing architecture

The existing V1.1 identity specification already provides:
- ProviderIdentity with LINE/GOOGLE separation;
- OTP domain foundation;
- Network Member registration/profile/consent concepts.

This R1.0B decision promotes the required Web authentication capabilities into the active release scope.

The prior rule that SMS/Google were future-only is superseded only for the Web Member authentication capabilities explicitly approved here.
