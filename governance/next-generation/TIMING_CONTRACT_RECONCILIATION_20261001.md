# Timing contract reconciliation — 2026-10-01

## Actual gaps and repairs

The preserved f4fadc8 runtime already returns job `processTiming`, but its typed Compensation OpenAPI response omitted it and Operations used a generic envelope. The shared DTO now documents availability, actual database entry time, nullable elapsed seconds and durable transition basis. The paged Operations output documents nullable timing for recognition, current-page coverage, thresholds, cursors and safe source/action/candidate fields. Period-end and eligibility ages explicitly remain different from current-stage timing.

The full governance run first stopped at `OPENAPI_V1_PREFIX_REQUIRED`: the existing user-required canonical `POST /api/line/webhook` was present in the generated artifact. The exact provider ingress is retained and checked for POST-only operation identity, required raw-body signature header and 200/401/503 outcomes. Negative tests still reject other verbs/routes, changed identity and missing signature/error contracts. The route remains scanned/validated/diffed. See [authority reconciliation](../swaggerhub/OPENAPI_PROVIDER_INGRESS_SCOPE_20261001.md). No baseline promotion, hidden operation, diff suppression or economic rule change.

The inspected My Growth invariants now have an explicit source matrix. Its old subscription labels are corrected to 重銷方案／方案迄月, with scheme status separate from per-period recognition. This is limited terminology correction; all data/economic behavior and existing links remain unchanged.

## Final verification

- Full existing OpenAPI governance gate **PASS**: generated artifact, secret scan, pinned oasdiff 1.32.1 validation, strict WARN/ERR comparison with **zero breaking findings**, publisher tests, contract/security regression.
- Full isolated API **183 suites / 1,327 tests PASS**, fresh **125 migrations**, **162 baseline assertions**, per-suite isolation and cleanup PASS.
- Artifact timing/authentication contract tests **3/3 PASS**; pinned governance/publisher tests **25/25 PASS**, no skipped cases. Focused actual HTTP/PostgreSQL **3 suites / 33 tests PASS**.
- API build/OpenAPI/security preflight PASS. Limited Member terminology change: existing Growth test **1/1 PASS**, Member production build PASS. No new mirrored tests for label-only changes.
- Approved baseline SHA-256 remains `b619d56a1406393eda95f949383b460913bb324aa146a988f387437ab22e56f2`. Final generated artifact, gate report, candidate file hashes and log digests are preserved in `evidence/timing-contract-reconciliation-20261001.json`.

The gate report's commit field identifies the pre-commit base; `executionContext=local-working-tree` and retained file/artifact hashes identify the tested candidate. It is not CI publication evidence.

## Remaining full objective

Overall Compensation business-stage history remains incomplete; process-state timing is not substituted for it. Growth recognition presentation and complete browser/UX journeys remain open, together with Learning/Event assignments/reminders, personalized-message coverage and other unchanged internal queue items. The source matrix does not substitute for missing implementation or browser evidence.

`R1.0B_CR_BATCH_01_LOCAL_IMPLEMENTATION = IN_PROGRESS`

`FULL_ISOLATED_RECERTIFICATION = IN_PROGRESS`

`STAGE_RC = NOT_READY`

No Stage/Production deployment, live LINE configuration, bank transfer or SwaggerHub publication was performed.
