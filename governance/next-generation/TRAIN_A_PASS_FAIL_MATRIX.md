# Train A PASS/FAIL matrix

All required Train A validation gates passed; checkpoint code SHA is in the report. Evidence is executable output, not a replacement for formal UAT or Production approval.

| Gate | Result | Evidence |
|---|---|---|
| Backend API/Worker/database/shared/contracts build | PASS, integrated and synchronized workspaces | evidence/train-a-synchronized-build.txt |
| Full API, isolated fresh PostgreSQL | PASS: 69 suites / 673 tests | evidence/train-a-synchronized-api.txt |
| Member | PASS: 24 files / 142 tests | evidence/train-a-integrated-member.txt |
| Admin | PASS: 22 files / 68 tests | evidence/train-a-integrated-admin.txt |
| Shared incl Semantic, Classification, AsOf, tool gateway and Golden seed | PASS: 5 suites / 181 tests | evidence/train-a-classification-final.txt |
| New Explain API contracts/security | PASS: 3 suites / 34 tests; included in full API | evidence/train-a-explain-all.txt |
| Real PostgreSQL new structured Explain HTTP | PASS: 16 assertions; existing Explain DB 21 + HTTP 65 also pass | evidence/train-a-explain-db.txt |
| Decision v3 Mandatory | PASS: T01–T17 | evidence/train-a-integrated-v3.txt |
| Boundary B01–B20 | PASS via Shared and full API source mapping in report | Shared/API logs |
| Return/Replay, Carry convergence, clawback and original PAID preservation | PASS: API, phase2 154 DB assertions, RC isolated DB cases | evidence/train-a-phase2-db-regression.json; API/RC logs |
| Economic R1.0B regression | PASS: GOLDEN_R1B_REGRESSION_PASS / GOLDEN_ECONOMIC_CASES_PASS | evidence/train-a-integrated-rc.txt |
| Prisma validate / generate / migrate | PASS: unchanged schema, 53 migrations | evidence/train-a-integrated-rc.txt |
| OpenAPI export / preflight | PASS: 159 operations; 157 existing operations unchanged | evidence/train-a-integrated-rc.txt |
| Security / TODO gate | PASS | evidence/train-a-integrated-rc.txt |
| RC gate | PASS incl isolated DB golden, OpenAPI and HTTP health | evidence/train-a-integrated-rc.txt |
| Existing economic source/schema unchanged | PASS | evidence/train-a-economic-source-hashes.json |
| Company profile exact mapping | PENDING_MAPPING: monetary activation closed; non-monetary work may continue | COMPANY_BOOTSTRAP_PROFILE_V1_PENDING_MAPPING.md |
| Stage/Production / formal UAT / external provider certification | NOT EXECUTED by this task | Outside Train A authorization |

The last remote synchronization added a provider certification/workload harness only. Full build/API were rerun after that integration; RC/Decision/Member/Admin results above apply to unchanged corresponding paths. Shared was rerun after the additional privacy aliases. Earlier failed preflight and UAT test attempts are documented in the report; no failed attempt is counted as PASS.
