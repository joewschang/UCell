# V1.20 Provider Event Canonicalization Report

Status: IMPLEMENTED — IDEMPOTENCY CONTRACT SLICE
Date: 2026-09-17
Branch: integration/member-backend-mvp

## Scope delivered

- Added canonical provider-event construction shared by verified webhook, provider query, reconciliation and controlled POS evidence paths.
- Explicit provider event IDs are trimmed and namespaced by provider.
- When a provider supplies no event ID, identity is derived from a deterministic SHA-256 hash of canonical safe evidence.
- Hash input includes provider, evidence source, provider transaction reference, canonical status, sanitized metadata and occurredAt when supplied.
- Metadata key order does not change identity.
- Raw signature/secret differences do not create distinct business events because secrets are redacted before hashing.
- Changed safe business evidence changes the payload hash, allowing the existing replay/conflict decision to reject event-identity reuse with altered content.
- Blank event IDs and missing provider transaction references fail closed.
- PAN/CVV protection runs before hashing.

## Verification

- Focused provider canonicalizer Jest: 1 suite, 8 tests PASS.
- Backend API build: PASS.
- Isolated Backend API Jest: fresh DB, 39 migrations, 21 suites, 224 tests PASS.
- Isolated database cleanup: PASS.
- No schema, provider enablement, credential or monetary-rule change.

## Remaining gates

Transactional persistence must eventually enforce provider + event identity uniqueness and write Payment transition/outbox evidence atomically under the designated schema owner. Official provider signature/checksum verification and sandbox/UAT remain blocked on formal provider material and credentials.

Production Promotion remains blocked.
