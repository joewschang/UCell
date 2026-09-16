# UCell Next Release Authentication Channel Decision
Status: APPROVED DESIGN BASELINE
Date: 2026-09-17
Scope: current LINE OA/LIFF member frontend and future Web/App authentication.

## Decision
LINE is the primary and only enabled member authentication provider for the current LINE OA/LIFF product track.

SMS OTP Login and Google OIDC remain architecture-ready but FEATURE_DISABLED for the current LINE OA release. They are planned for future Web and native App channels and MUST NOT block current V1.1/V1.2 LINE OA Production readiness.

## Current LINE OA authentication flow
LINE OA/LIFF -> LINE authentication/ID token -> Backend verifies token -> ProviderIdentity(LINE) -> Person -> opaque UCell member session -> server-authorized Qualification/Ball access.

LINE authentication identifies/authenticates Person. It does not by itself authorize Qualification ownership, Sponsor relationship, placement, KYC approval or monetary rights.

## Network member registration under LINE
Authenticated LINE Person -> applicable contract/privacy notice -> collect basic profile (name/display-name policy, alias, gender, birth date, mobile contact, email) -> NETWORK_MEMBER.

Mobile is contact data in the current LINE OA track; SMS OTP verification is not required merely because a mobile number is collected. Email is also contact data and is not a login credential by default.

## Formal member upgrade under LINE
Authenticated LINE session -> formal-member contract/privacy notice -> required formal data -> ID/bank evidence -> KYC submit/review -> FORMAL_MEMBER -> formal-member-only Qualification workflow when applicable.

Current LINE OA formal upgrade does NOT require SMS OTP as an additional authentication step unless a future risk/legal decision explicitly enables step-up verification for a sensitive action.

## Provider architecture retained
ProviderIdentity remains multi-provider capable. Feature flags/channel policy:
LINE_LOGIN = ENABLED for LINE OA/LIFF.
SMS_OTP_LOGIN = DISABLED_CURRENT / FUTURE_WEB_APP.
GOOGLE_OIDC_LOGIN = DISABLED_CURRENT / FUTURE_WEB_APP.
ACCOUNT_PROVIDER_LINKING = DISABLED_CURRENT unless explicitly enabled later.
ACCOUNT_RECOVERY_OTP = FUTURE.
SENSITIVE_ACTION_OTP = FUTURE/RISK_BASED.

Do not delete OTPChallenge or Google ProviderIdentity design contracts; keep them dormant and unprovisioned in current LINE OA runtime.

## OTP purpose model retained
Future OTP purposes may include LOGIN, PHONE_VERIFY, ACCOUNT_RECOVERY, BANK_CHANGE, PROVIDER_LINK, SENSITIVE_ACTION. Current release enables none by default. If any purpose is later enabled, the approved OTP security baseline applies.

## Referral + LINE OA flow
Shared signed UCell referral URL -> Backend referral landing -> record/validate 30-day provisional attribution -> signed opaque transition state -> open LINE OA/LIFF -> LINE authentication -> bind eligible anonymous attribution to Person -> Network registration/formal conversion as applicable.

Referral attribution != authentication != Sponsor. At Qualification Sponsor-conversion time Core validates the applicable referral attribution/rule. Existing Sponsor history remains immutable.

## Readiness impact
Remove SMS provider/account as blocker for current LINE OA V1.1/V1.2 authentication path.
Remove Google OAuth client as blocker for current LINE OA V1.1/V1.2 authentication path.
Formal LINE/LIFF credentials and real-device LIFF/UAT remain blockers for the current member frontend.
SMS/Google become FUTURE_WEB_APP_AUTH configuration prerequisites only.

## Security
Do not treat LINE display name/email/phone hints as KYC proof. Backend validates LINE tokens. UCell session remains opaque and expiry-controlled. Qualification ownership is checked server-side. Sensitive KYC/bank changes may later introduce step-up verification without changing the Person/ProviderIdentity model.

## Migration/implementation rule
Current R1.0B Core Closure remains Gate 0. This decision updates future design/readiness only; it does not authorize broad next-release coding before Gate 0 approval and does not modify R1.0B monetary semantics.