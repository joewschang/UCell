# V1.1 Delivery Profile / Checkout Completion — 2026-09-17

Status: IMPLEMENTED ON INTEGRATION; Production Key Vault secret, privacy notice and UAT remain configuration/legal gates.

Authenticated members can read and update only their own current delivery profile through `GET/PATCH /api/v1/member/delivery-profile`. The mutation is Serializable and idempotent, closes the previous effective version, creates a new version, and appends audit/outbox evidence. Database guards reject historical rewrite and deletion and enforce one current profile per Person.

Phone and structured street address are encrypted with AES-256-GCM and a versioned deployment key. Missing or unavailable key configuration fails closed. Raw phone/address values are absent from audit, outbox and idempotency response evidence. Production must source the encryption key from the approved secret manager; TEST_ONLY Golden configuration is not Production key evidence.

Connected Member checkout reads Backend authoritative profile state and blocks order creation while delivery data is incomplete. Saving delivery data is separate from Formal Member/KYC and never creates or mutates Qualification, Sponsor/Binary placement, price, PV/BV or monetary facts.

Verification includes fresh forward-only migration, encrypted-at-rest assertions, exact owner read-back, lost-response replay, version replacement, database history guards, Member checkout gating, API/Worker builds, OpenAPI and schema/migration/static/security preflights.
