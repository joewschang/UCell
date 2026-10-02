# R1.0B closure + R1.1 integrated execution

Authority: Product Owner request on 2026-10-03 to include R1.1 and continue completion. Branch: feature/r1.1-geo-stage-20261003, based on verified Stage integration aa48cac9. Production remains a separate release decision.

## Scope and order

1. Geo-5/6/7: central GPV vocabulary, official versioned Taiwan city/district seed, forward-only geo profile/history schema, deterministic communication-address normalization and idempotent source refresh. Missing, overseas and ambiguous addresses remain explicitly unlocated. Never substitute delivery address or representative address for the holder's communication address.
2. Geo-8: reuse historical Binary ancestry/firstSide, owner intervals, Active evidence, distinct GPV source/replay corrections and sealed Carry/Pair. Preserve asOf and knowledgeCutoff; missing evidence returns UNAVAILABLE. Company/LegalEntity ownership is not coerced into a Person. Separate ball/member grains.
3. Geo-9: authorized summary/distribution/branch comparison/trend/top markets/export, identical context and privacy-safe output. Use the existing protected /api/v1/admin route convention; document compatibility with the proposed spec route. No Member geo route or automatic PII lookup.
4. Geo-10: Admin root Ball search, filter controls, city/district drilldown, map/table/charts and descriptive insights, no client economic calculations.
5. Geo-11: real DB reconciliation, historical/replay/ownership fixtures, RBAC and privacy HTTP tests, export equivalence, performance bounds and R1.0B regression. UAT captures actual desktop/mobile behavior; unavailable browser tooling is not a PASS.
6. Integrate validated Geo into Stage, apply checksum-verified forward migrations and verify immutable artifacts and service health. Update Issues #5–#11 and integration PR with evidence.
7. Continue R1.0B closure: Google/email/KYC external configuration, connected UAT, approved OpenAPI baseline review and main merge. SMS OTP and inventory PICK/SHIP remain deferred by their existing decisions.

## Reuse and unresolved evidence

- Existing binary-tree-metrics.ts verifies source replay envelopes and sealed settlement/replay values. Geo may factor out shared source reading, but must preserve every existing check and test.
- Communication address currently exists inside encrypted formal application payloads; delivery profiles are a different purpose. Historical normalization must bind to source snapshot/version and record time, not current mutable application data.
- Administrative seed source: NLSC county/town code services, https://data.gov.tw/dataset/102011. Pin downloaded bytes/checksum/date. No live external calls per dashboard read.
- OpenAPI baseline remains unchanged until recorded Code Owner authority; intentional differences must remain visible.
- Google OAuth Stage project/client ID is configured and deployed; completed registration/member-homepage UAT remains pending. Email delivery and trusted KYC scanner configuration remain pending; do not invent credentials or claim provider completion.

## Acceptance

All GEO-01–GEO-15 and release gates in UCELL_R1_1_GEO_ORGANIZATION_ANALYTICS_SPEC.md remain required. Implementation, external configuration, UAT and Production status are recorded separately. An open GitHub issue is not evidence of missing code; closure requires current implementation and validation evidence.
