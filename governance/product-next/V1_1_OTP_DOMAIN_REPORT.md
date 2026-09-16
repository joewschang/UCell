# V1.1 OTP Domain Foundation — 2026-09-17

Status: ARCHITECTURE READY; `FEATURE_DISABLED` for the current LINE OA release.

`NEXT_RELEASE_AUTH_CHANNEL_DECISION_APPROVED.md` makes LINE the primary and only enabled authentication provider for the current release. Network registration and formal-member upgrade therefore do not require SMS OTP. Mobile and email are contact data in those flows. The API enforces this at runtime: both OTP challenge creation and verification fail closed with `SMS_OTP_FEATURE_DISABLED` unless `AUTH_CHANNEL_ENABLE_SMS_OTP=true` is explicitly supplied by a future approved deployment configuration.

The dormant OTP domain remains available for a future approved step-up flow: six numeric digits, five-minute expiry, five verification attempts, 60-second resend cooldown, five sends per rolling hour and ten per rolling day. Destination and OTP values are stored only as keyed SHA-256 fingerprints/hashes; the raw OTP is neither persisted nor returned. Challenge creation is Serializable and idempotent. Verification locks the challenge row and persists attempts.

Golden DB enables the feature only with an explicit `TEST_ONLY` environment value and injects a synthetic provider. This proves the dormant architecture without representing Production SMS delivery evidence. SMS provider credentials are not a current LINE OA release blocker.
