# Phase 1 Local Baseline Release Manifest

- Release: PHASE_1_LOCAL_BASELINE_2026-09-26
- Frozen source: $base
- Git tag: phase1-local-baseline-20260926
- Timestamp: 2026-09-26 Asia/Taipei
- Migration count: 86
- OpenAPI: 1.1.0; 186 paths, 201 operations, 92 schemas
- OpenAPI artifact/baseline SHA-256: 619d56a1406393eda95f949383b460913bb324aa146a988f387437ab22e56f2

## Certification

G1 Functional Closure, G2 Migration Integrity, G3 Fresh 0→current, G4 Full Regression, and RC isolated are PASS.

Evidence: API 115 suites / 867 tests; Admin 32 files / 116 tests and production build; Member 31 files / 175 tests and production build; Worker, Shared, Contracts and Database builds; fresh 86-migration isolated DB with 154 assertions; DB/Economic/R1B Golden; P0 reconstruction; privacy, BOLA/IDOR and LINE security; Paper, Retail Referral and WEB_MEMBER commerce real-DB closure; OpenAPI governance.

## Limits and deferred work

No Stage or Production deployment occurred. Formal Stage LINE/LIFF and Entra credentials, hosted SwaggerHub publication credentials, and human UAT are operational inputs, not local certification. G8 operational readiness and Phase 2 Semantic/Data Governance/Analytics Runtime/AI work remain deferred.

## Drive

DRIVE_SYNC_PENDING: implementation status, this manifest, baseline-promotion decision, Paper/LINE closure, Retail closure, commerce closure, and Stage RC plan require synchronization to the corresponding formal Google Drive records when approved Drive write access is available. No Drive synchronization is claimed.

## Protection

Any post-freeze change must record defect/change classification, authority, impact and regression scope, new HEAD, and re-certification of invalidated evidence. It must not silently replace this tag.
