# Train D Experience V2 pass/fail matrix

| Area | Status | Evidence / disposition |
|---|---|---|
| P0 business identifiers and privacy boundary | PASS (local) | API full suite, Member/Admin suites, DB Golden and P0 reconstruction pass. |
| Member global Ball context | PASS (local) | Member test suite and synthetic multi-Ball UAT identities. |
| Member organization, money, and safe Explain | PASS (local) | Existing Member-safe DTO/route tests remain in the full Member suite. |
| Member checkout and delivery profile | PASS (local) | Connected-shop tests cover explicit cart, authoritative profile, idempotent retry, disabled/incomplete profile, and no client price/PV submission. |
| Person 360 / Ball 360 / Tree / placement | PASS (local) | Admin full suite and API isolated full suite pass. |
| Settlement, Return, Reservoir, Analytics, Release controls | PASS (local implementation) | API, DB Golden, Decision v3, economic golden, OpenAPI, Admin suite and RC isolated pass. |
| Fresh migration and identifier integrity | PASS | 70-migration fresh deployment and read-only reconstruction both pass. |
| OpenAPI contract | PASS | Export/preflight pass; 162 paths, 175 operations, 80 schemas. |
| Local UAT runtime | PASS | PostgreSQL/API/Admin/Member are running with synthetic data. |
| Formal identity E2E | EXTERNAL_IDENTITY_PENDING | No Stage Entra or LINE/LIFF credentials. |
| Manual accessibility / UAT sign-off | PENDING_MANUAL | 200% native zoom and human workflow sign-off require human execution. |
| Stage / Production | STOP / BLOCKED | Explicitly not deployed or migrated. |
