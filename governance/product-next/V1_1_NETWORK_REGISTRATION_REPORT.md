# V1.1 Network Registration Transaction — 2026-09-17

Status: IMPLEMENTED ON INTEGRATION; Production contract/privacy text and SMS delivery remain blocked.

`POST /api/v1/registration/network` now atomically validates an effective required contract, locks and consumes matching verified mobile OTP evidence, creates one EFFECTIVE Person with `NETWORK_MEMBER` state, appends membership-state and consent evidence, writes audit/outbox events and returns provider-link options. The transaction is Serializable and idempotent. A mobile fingerprint advisory lock plus recheck prevents concurrent duplicate registration. The flow explicitly returns `qualificationCreated: false` and never creates Sponsor/Binary/Qualification or monetary facts.

Existing Persons are not reclassified. OTP evidence must match the registration session, E.164 mobile fingerprint, NETWORK_REGISTRATION purpose, VERIFIED state and expiry, and can be consumed once.

Fresh DB with 30 migrations and Member Identity Golden 318 HTTP/DB assertions PASS, including Person creation, one state event, one consent, OTP ownership, zero Qualification and lost-response retry. Initial Golden exposed Prisma deserialization of PostgreSQL advisory-lock `void`; the query now executes the lock in a subquery and returns only a supported boolean. No assertion was weakened.
