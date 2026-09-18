# Train B foundation PASS / FAIL matrix

This matrix covers the implemented checkpoint. It is not a full-program, formal-UAT or Production approval.

| Check | Result | Evidence |
|---|---|---|
| Backend API/Worker/database/shared/contracts build | PASS | evidence/train-b-backend-build.txt |
| Fresh PostgreSQL migration chain | PASS, 54 migrations; old 53 unchanged | evidence/train-b-rc.txt; source manifest |
| Full isolated API | PASS, 73 suites / 734 tests | evidence/train-b-api.txt |
| Admin build and components | PASS, 23 files / 75 tests | evidence/train-b-admin-build.txt; evidence/train-b-admin-tests.txt |
| Member regression | PASS, 24 files / 142 tests | evidence/train-b-member-tests.txt |
| Shared contracts | PASS, 5 suites / 181 tests | evidence/train-b-shared-tests.txt |
| Decision v3 mandatory | PASS, T01–T17 | evidence/train-b-v3.txt |
| RC / original DB golden / HTTP health | PASS | evidence/train-b-rc.txt |
| Original 159 OpenAPI operations/schemas | Unchanged; total 167 operations | evidence/train-b-openapi-comparison.json |
| Bootstrap atomicity, lost response, duplicate concurrency | PASS | binary-tree-db.e2e-spec.ts in full API |
| All 24 founding orders and first/third LEFT rule | PASS; right-root first sequence 3 is correctly rejected | full API |
| 14-generation counts / cross-tree rejection / closed preview | PASS | full API |
| Company owner EXIT/retransfer / preserved identity and kind | PASS | full API |
| Revoked sessions, operator role boundaries and preflight binding | PASS | full API; Admin tests |
| Direct SQL canonical/occupation mismatch, fake holder and Payable | Rejected | full API |
| Lease fencing, out-of-order and duplicate tree events | PASS | full API |
| GPV exact decimals, original month and POSTED corrections | PASS | binary-tree-metrics.e2e-spec.ts |
| Carry original/replay, missing or ambiguous evidence | PASS, fail-closed | binary-tree-metrics.e2e-spec.ts |
| Company profile exact mapping and monetary activation | PENDING_MAPPING / NOT ACTIVATED | profile decision record and SQL guards |
| Large/skewed 10K/100K/1M scale; durable generation pagination | NOT VERIFIED / additional implementation required | limits in TRAIN_B_REPORT.md |
| Period projection rebuild/export, remaining proposed analytics/AI/UI | NOT COMPLETE | remaining scope in report |
| Formal browser UAT / Stage / Production / provider certification | NOT EXECUTED | outside this checkpoint |

Failed attempts excluded from PASS counts: missing isolation environment, obsolete test doubles, TypeScript fixture/UI typing errors, and legacy Phase 2 DB-name guard rejection. See the report for corrective actions.
