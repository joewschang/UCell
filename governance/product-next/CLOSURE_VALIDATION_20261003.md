# Integration closure validation — 2026-10-03

Canonical integration remains PR 23. PR 21/24 reconciliation and the verified Stage Admin/member artifacts are recorded in PR_RECONCILIATION_20261003.md and deployment evidence. This change only adds/fixes tests; it does not activate inactivity execution or change Stage runtime/schema.

## Real database evidence

The isolated Geo test now creates a separate company bootstrap tree, two stored sealed GPV sources (LEFT 100.1234, RIGHT 200.0000), a real order/product/order line, a posted return line, its -20 GPV reversal and audit evidence. The authorized Geo service executes actual PostgreSQL ancestry/source queries. Assertions verify 300.1234 at the prior knowledge cutoff, 280.1234 after the return is known, LEFT 80.1234 / RIGHT 200.0000, matching unlocated distribution, and identical repeated capture without double subtraction. Synthetic fixtures run only in localhost randomly named ucell_jest databases.

The preceding backend CI run 37057571163 passed build, migrations and DB golden but failed one of 1438 tests: the compensation-history paging test captured a JavaScript millisecond cutoff immediately after PostgreSQL microsecond observations. A committed row could still be after that cutoff. The test now establishes a later cutoff before expecting all prior rows; it retains assertions that newer observations are excluded from an existing snapshot. No production time filter was loosened.

Validation: isolated suites organization-geo-db.e2e-spec.ts and compensation-stage-history-http.e2e-spec.ts: **2 suites / 11 tests PASS**, existing **162 real DB assertions PASS**, isolated cleanup PASS. Log: C:/UCell/logs/closure-db-tests-20261003.log. Full remote CI must be checked against the resulting commit; earlier results are not attributed to it.

## Remaining acceptance

Additional ownership validation: the real DB fixture places two member balls in opposite root branches under one Person, then records an effective holder transfer for one ball. Current context reports eight descendant balls / two distinct members; either a pre-transfer asOf or a pre-transfer knowledgeCutoff reports the same eight balls / one distinct member. Both member balls remain Active UNKNOWN with activeRate null; LEFT/RIGHT remain 4/4. Response excludes person identifiers and names. This fixture is an isolated history test, not a Stage ownership command. Validation: organization-geo-db.e2e-spec.ts **9 tests PASS**, existing **162 DB assertions PASS**, cleanup PASS; log C:/UCell/logs/geo-owner-history-20261003.log.

Additional Carry/Pair validation: an isolated real PostgreSQL fixture stores a FINALIZED BINARY_K1 batch, BinaryCarry and a hash-verified historical seal. Geo capture returns original LEFT 20.0000 / RIGHT 10.0000 / pairedPv 100.0000 at the original knowledge checkpoint. A real posted-return reference creates a pending recalculation; that checkpoint withholds Carry with CARRY_REPLAY_PENDING even after processing is subsequently recorded. After processing, Geo reads stored replay LEFT 3.5000 / RIGHT 0.0000 / pairedPv 42.1250 and its sequence, with identical repeated capture. The original stored pairedPv remains 100.0000. These are TEST_ONLY isolated fixtures, not Stage settlements or approval commands. Validation: organization-geo-db.e2e-spec.ts **10 tests PASS**, existing **162 real DB assertions PASS**, isolated cleanup PASS; log C:/UCell/logs/mainline-geo-carry-db-20261003.log. Runtime and economic rules are unchanged.

- Geo: approved address-history fixtures, broader owner types, scale projection beyond existing safe bounds, and formal Entra desktop/mobile UAT remain outstanding. The added Carry/Pair, source and member-owner fixtures do not close all GEO-01–GEO-15 gates.
- Earlier OpenAPI run 37057571159 failed with UNAPPROVED_BREAKING_CHANGE. The recorded owner approval and selective baseline promotion now resolve those twelve findings: source f70c3cf66b32db2e52db27d282311988e8ca6379 passed OpenAPI governance run 37089691305, RC CI 37089691300 and Member checks 37089691400. RC CI confirms 208 API suites / 1449 tests and 162 real DB assertions. See governance/swaggerhub/FORMAL_ENROLLMENT_BASELINE_PROMOTION_20261003.md. Gate severity and security controls remain unchanged. This CI receipt does not waive UAT or Production prerequisites.
- Actual completed Google registration/member-homepage UAT remains pending; Stage Google configuration and gender/mobile validation fixes are deployed.
- Formal Stage Entra app/access grants, password-reset email delivery and trusted KYC scanning remain pending external integration.
- Production release requires approved company member-contract/privacy documents. Stage blank documents are test-only and expire 2026-10-10T00:00:00Z; see PRODUCTION_CONTRACT_DOCUMENTS_BLOCKER_20261003.md.

No main merge, Production deployment or blanket acceptance closure is claimed.
