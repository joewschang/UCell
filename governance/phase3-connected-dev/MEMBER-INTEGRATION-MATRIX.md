# Member Connected DEV integration matrix

Date: 2026-09-16. Branch: integration/member-backend-mvp. Production BLOCKED.

| Area | Evidence | Classification |
|---|---|---|
| Orders/create/detail | Core prices, ownership, payload rejection, stable-key retry/conflict/concurrency/audit rollback, old price replay | CODE COMPLETE / CONNECTED DEV PASS; payment/PV recognition/ERP not claimed |
| Notifications/read-state | Owner-bound first read, idempotent PATCH, concurrent/rollback retry; transactional outbox notice/ack/duplicate/ack-failure retry | CODE COMPLETE / CONNECTED DEV PASS; no LINE push |
| Profile | Own Person contacts only; forbidden identity/Qualification fields, idempotency/concurrency/audit rollback | CODE COMPLETE / CONNECTED DEV PASS |
| Repurchase Dashboard | Backend recognition status; no frontend Active calculation | CONNECTED DEV PASS |
| Ball switching/views | Ball1 PV/RPV/EPV 11/2400/1680; Ball2 23/1200/480; separate Sponsor/Binary; non-empty bonus/ledger | CONNECTED DEV PASS |
| Monetary display | Server pending/null, held award disclosed; forced same-timestamp lifecycle tie deterministic; original monetary history unchanged | CONNECTED DEV PASS |
| BOLA/IDOR/session | Both owned balls allowed; foreign/forged/missing context, wrong detail/audience, invalid/expired session denied | CONNECTED DEV PASS |
| LINE infrastructure | Official verifier adapter, opaque sessions, replay/concurrent exchange/session-write rollback tests | CODE COMPLETE; OPERATIONAL CREDENTIAL PENDING |
| Member UI | Real Shop/details/read-state/profile/repurchase; loading/empty/403/409/422/expiry; 99 tests, build | CODE COMPLETE / CONNECTED DEV PASS; browser UAT not claimed |
| Golden journey | 183 actual HTTP/DB assertions per fresh isolated run, twice; actual frontend contracts for both balls | CONNECTED DEV PASS; test-only synthetic LINE |
| OpenAPI | DTO/envelope/security/context/errors/pagination/idempotency/forbidden monetary properties | CONNECTED DEV PASS |
| Backend Phase 3 | API 106 tests; replay DB 129 assertions; TODO 148 → 74 → 73 | INCOMPLETE; replay/carry/TODO work continues |
| Admin live DEV | Build/tests and 43 HTTP operations; Member unauthenticated direct bypass denied | CONNECTED DEV evidence in final matrix; formal Entra pending |
| Real LINE device / Entra | No formal credentials available | OPERATIONAL CREDENTIAL PENDING |
| Operational UAT/signoff | Browser Golden/device, operational calendar/config and signoff unavailable | UAT PENDING |
| RC/Release/Production | TODO and formal security/operations blockers | PRODUCTION BLOCKED |

Integration uses VITE_ENABLE_MOCK=false. Pure UI mock mode is retained. No fixture approves eligible-consumption scope, formal PV/BV event mapping, production calendar/cut-off. Asia/Taipei and historical fail-closed are settled. No non-MVP ERP/payment/LINE publisher scope was added.
