# Selective pre-GA baseline promotion — formal enrollment

Approval: 2026-10-03, @joewschang / Wei-Shiang Chang.
User decision: 「這些都是必要的修正，全部核准」; continuation authorized at 10:13:03 Asia/Taipei.

Candidate head: bfee94df955a358b86277fde2725904594c25c3b
Previous baseline SHA-256: b619d56a1406393eda95f949383b460913bb324aa146a988f387437ab22e56f2
New baseline SHA-256: 3b99a0207611c55c5d85e4e4d743c51c6b7013ac18b19a254942bdc312259ec3

Authority: FORMAL_ENROLLMENT_API_CHANGE_APPROVAL_20261003.md.
Previous bytes retained at governance/swaggerhub/baselines/baseline.openapi.1.1.0-b619d56a1406393eda95f949383b460913bb324aa146a988f387437ab22e56f2.json.
Pinned-tool twelve-finding evidence: governance/swaggerhub/evidence/formal-enrollment-openapi-breaking-diff-20261003.json.

## Selective scope
Only four request schemas (CreateMembershipApplicationDto, CreateQualificationDto, FormalMemberDraftDto, NetworkRegistrationDto) are aligned to the candidate, plus the two approved inline ownerType enums admitting LEGAL_ENTITY. Associated optional request properties and relaxation of personId requirements permit the approved legal-entity model. Other baseline paths, operations, security, schemas and response properties remain unchanged. This is deliberately not wholesale adoption of the generated candidate.

The approved hasSpouse input remains required; the candidate no longer declares a default. This avoids relying on a default to satisfy a required input. Removal of nationalId remains approved.

## Verification and release boundaries
Baseline JSON parses successfully; SHA-256 recorded above. The normal baseline review, security/secret scan, pinned oasdiff and contract test CI must run on this commit. No passing CI receipt is fabricated. Local verification used oasdiff 1.32.1; its release archive SHA-256 7c8939fc49b75ee11fec66a5b83b37a2fca6aee109fed85013b1ba2ac2a1ee7f matched the upstream release checksums. After the same comparison normalization used by the gate (header deduplication and inferred URI parameters), breaking comparison with --include-path-params --fail-on WARN returned exit code 0 and [] findings. This is a local compatibility result, not a full CI PASS receipt; remote CI remains authoritative. Any additional compatibility findings remain blocking. No rule severity, workflow, oasdiff configuration or security gate is changed. No main merge, Production deployment or automatic recovery is performed.
