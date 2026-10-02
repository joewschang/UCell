# OpenAPI Baseline Promotion Decision — Phase 1 v1.1.0

- **Decision date:** 2026-09-26
- **Approving decision:** Phase 1 Release Closure — explicit user authorization for controlled OpenAPI baseline promotion
- **Candidate commit:** 420ea21fbb8721543563b9beb273ad6cfac08515
- **Previous baseline:** OpenAPI 1.0.0, SHA-256 4ca2023863cdc12dd767c0e63cf836394d2d12899681e33c7fd635fb26ef674c
- **Promoted baseline:** OpenAPI 1.1.0, SHA-256 b619d56a1406393eda95f949383b460913bb324aa146a988f387437ab22e56f2
- **Scope:** Pre-GA Phase-1 compatibility baseline only. This promotion does not publish, deploy, or modify Stage or Production.

## Historical evidence

The previous baseline is retained byte-for-byte at `governance/swaggerhub/baselines/baseline.openapi.1.0.0-4ca2023863cdc12dd767c0e63cf836394d2d12899681e33c7fd635fb26ef674c.json`.

The exact pinned-oasdiff 1.32.1 breaking report produced before promotion is retained at `governance/swaggerhub/evidence/openapi-baseline-promotion-v1.1.0-breaking-diff.json`.

## Accepted pre-GA corrections

1. **Legacy UUID placement route removed.** `POST /api/v1/member/qualifications/{id}/place` remains removed. It exposed a technical Qualification UUID and conflicts with the approved P0 privacy model. Member placement is performed only with `placementReference` and public parent `ballNo`; the server resolves and validates all authority and topology.
2. **`memberNo` format corrected.** The former UUID declaration was incorrect. `memberNo` is the immutable ten-digit business identifier.
3. **Admin Qualification and subscription filters hardened.** Current v1.1 UUID, enum, and `take` bounds remain the approved contract because they match the authoritative server validation.

## Governance rule

- **Pre-GA:** A reviewed breaking contract correction may become a new baseline only through an explicit authority-approved promotion decision, a separately reviewable baseline/policy change, retained prior artifact and retained pinned-tool diff evidence.
- **Post-GA:** A breaking public API contract must not be hidden by a baseline promotion. It requires an approved compatibility, deprecation, or major-version strategy.

The normal breaking-change gate remains strict after this promotion. No oasdiff rule, severity, validation, security comparison, or API contract was weakened.
