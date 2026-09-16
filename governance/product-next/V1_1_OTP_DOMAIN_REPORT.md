# V1.1 OTP Domain Foundation — 2026-09-17

Status: IMPLEMENTED ON INTEGRATION; Production SMS provider remains CONFIG_PENDING.

The OTP domain implements the approved baseline: six numeric digits, five-minute expiry, five verification attempts, 60-second resend cooldown, five sends per rolling hour and ten per rolling day. Destination and OTP values are stored only as keyed SHA-256 fingerprints/hashes; the raw OTP is neither persisted nor returned. Challenge creation is Serializable and idempotent. Verification locks the challenge row, persists every failed attempt, locks on the fifth failure and returns the original verified result on redelivery.

The SMS adapter intentionally fails closed with `SMS_PROVIDER_CONFIGURATION_PENDING`. Golden DB injects a TEST_ONLY provider and deterministic code; this is not Production delivery evidence.

Verification: Prisma validate/generate/migrate deploy PASS; fresh database with 29 migrations PASS; Member Identity Golden 309 HTTP/DB assertions PASS including no-code response, create replay, failed attempts, success replay and persisted lockout. Backend API, four builds and static/security/contract gates are rerun before checkpoint. No Qualification or monetary model is created or changed.
