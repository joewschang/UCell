# V1.1 LINE-first Network Registration — 2026-09-17

Status: IMPLEMENTED ON INTEGRATION; formal LINE/LIFF credentials, approved contract/privacy content and UAT remain Production blockers.

The approved channel rule is enforced by authenticated `POST /api/v1/member/registration/network`. The endpoint requires a valid LINE-backed UCell member session, records the accepted effective contract version, completes the existing Person's basic profile, and transitions that Person to `NETWORK_MEMBER`. Mobile and email are stored as contact data; registration does not request, verify or consume SMS OTP evidence.

The transaction is Serializable and idempotent. It locks the submitted mobile identity, rejects ownership by another Person, preserves immutable consent evidence, appends membership-state and audit evidence, and emits one registration outbox event. It explicitly returns `enabledAuthenticationProvider: LINE` and `qualificationCreated: false`. It creates no Person, Qualification, Sponsor/Binary placement or monetary fact.

The previous unauthenticated OTP registration route was removed because it conflicted with `NEXT_RELEASE_AUTH_CHANNEL_DECISION_APPROVED.md`. OTP and Google structures remain dormant and feature-disabled for future approved releases. Golden coverage verifies same-Person completion, contact-only mobile semantics, no OTP consumption, no Qualification creation, immutable consent reuse and lost-response replay.
