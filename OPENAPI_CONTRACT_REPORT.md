# OpenAPI contract report

Status: **local implementation and validation PASS; hosted CI activation pending**.
This report is not a signed Release/RC approval and cannot substitute for a successful same-commit CI publication receipt.

| Artifact metric | Value |
| --- | --- |
| Generated documentation version | 1.1.0 |
| Runtime API prefix | /api/v1/ |
| OpenAPI path count | 154 |
| HTTP operation count | 167 |
| Named component schema count | 75 |
| Generated artifact SHA-256 (raw bytes) | 2800e9779fcaeeea8be5fc7ef781c0c95ebb663219055589496272e0a1de5aef |
| Generated canonical JSON SHA-256 | ca2e6a9eb83005a6f2a1c951d7b293d6b8f5af4ada534fc858bb72b02f09d4f0 |
| Approved 1.0.0 baseline raw SHA-256 | 4ca2023863cdc12dd767c0e63cf836394d2d12899681e33c7fd635fb26ef674c |
| Last verified private SwaggerHub version | 1.0.0 |
| Last verified SwaggerHub canonical artifact SHA-256 | e69c5678c01fe98e1878e7afc6eac6945caf3194bb19778c20d177e498a39a93 |
| Historical raw SwaggerHub response SHA-256 | Not captured by the initial manual import; not fabricated |
| New CI publication raw SHA-256/version | Pending actual CI publication; publisher records both after readback |

## Validation and tests

- Complete local gate: PASS, using the working tree based on 26fa675da0132646484b4a8806a8d5ab55e0e6f6.
- OpenAPI validation: no findings with checksum-pinned oasdiff 1.32.1.
- Secret/examples/reference scan: PASS for candidate and approved baseline.
- Breaking diff: no findings after explicitly recorded comparison normalization.
- Authentication/security compatibility: PASS.
- Publisher regression tests: 24 passed, zero skipped; real oasdiff fixtures reject operation removal, required-input addition and response-type changes.
- Full isolated API suite: 73 suites, 734 tests PASS; 154 additional real DB assertions PASS; temporary DB cleaned up.
- Security-policy and TODO gates: PASS.
- Workflow YAML parsing, baseline boundary, release-readiness preflight and git diff --check: PASS.
- Live CI/API-key publication was not attempted and is not claimed as PASS.

## Contract correction and comparison policy

The existing return-reversal URL included orderId but lacked its OpenAPI parameter declaration. The annotation is fixed without changing runtime behavior; the latest integration source also adds compatible operations, so documentation receives minor version 1.1.0. The approved raw 1.0.0 baseline remains unchanged.

The baseline also contains case-variant duplicate Idempotency-Key declarations. Both diff views deduplicate only identical header definitions (conflicts fail) and represent undeclared URI placeholders as mandatory strings. Those implied URI requirements already existed in the route. Both comparison-view hashes are retained in local-verification.json. Candidate validation precedes normalization; genuine path, schema, response, required-input and authentication changes remain gated.

## Governance coverage

1–3: generated local spec is SSOT; one-way private publication; cloud suggestions require a source PR, never automatic import.
4: paths/operations/schemas and generated/published raw and canonical hashes/version are independent fields.
5–9: validation, protected approved baseline, strict diff, contract/security and publisher tests precede the sole credential-bearing publication job.
10–13: exact semantic readback, pre/post private checks, example/secret scanning, bounded retries, nonzero errors and retained failure artifacts.
14–16: publisher has no database access or application rollback; /api/v1 enforced; Experience v2 does not create /api/v2.
17: publishing/versioning/breaking/rollback/permissions/rotation procedures are in governance/swaggerhub/README.md.
18: workflow writes OPENAPI_CONTRACT_REPORT.md and SWAGGERHUB_SYNC_EVIDENCE.json; RC fetches successful same-commit trusted workflow artifacts and rejects missing/stale evidence.

## Activation and evidence

Before hosted synchronization can operate, merge this reviewed workflow into the protected default branch, configure code-owner/required-status enforcement, and create the protected swaggerhub-docs environment (required reviewers, no self-review, default-branch restriction) with SWAGGERHUB_API_KEY in approved secret storage. Personal Codex OAuth is not used by CI. Missing credentials block publication.

The first approved CI publish will target private ragetech/ucell-api/1.1.0. The existing private 1.0.0 cloud artifact was not modified by this task. No Stage or Production deployment occurred.

Files: [workflow](.github/workflows/swaggerhub-sync.yml), [governance](governance/swaggerhub/README.md), [local verification](governance/swaggerhub/local-verification.json), [Release/RC integration](backend/release/SWAGGERHUB_SYNC_IMPLEMENTATION.md).

Hosted checks confirmed main is still the initial commit, has no protection, and no CI environment or SwaggerHub CI secret is provisioned. The review branch targets integration/member-backend-mvp; no unrelated source promotion or default-branch switch is included. Automatic approval review blocked hosted protection/environment mutations pending explicit approval.
