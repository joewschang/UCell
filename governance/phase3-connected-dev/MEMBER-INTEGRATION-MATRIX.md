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

## Member / Admin gap-closure checkpoint

Latest source adds server-confirmed context switching, Person-only account access, scoped Core recognition details and authenticated UCell-session revocation. Member: 106 tests and 201 fresh isolated HTTP/DB assertions twice. Product used by checkout is created through actual ProductService with prospective parameter hash; legacy profiles remain untouched. Logout rollback/concurrency/other-session isolation is DB asserted. Admin: 11 frontend tests, live HTTP suite and five-screen real UI/API smoke; authoritative remaining reversible quantities and Core return totals replace browser estimates. The exact final HTTP count is recorded in final/admin-dev-full-test.txt.

Member mobile browser smoke PASS is explicitly MOCK UI only, using installed local Edge; it does not verify formal LINE. Connected Admin smoke is local DEV demo with real Core reads, no network mutation or formal Entra proof. Full functional/code blockers are listed in UI-FUNCTION-INVENTORY.md. Subscription versioned scheduling/cancellation engineering remains INCOMPLETE; production calendar/configuration is independently pending. Formal credentials/UAT/Production remain blocked. TODO stays 73 for this UI batch; no placeholder conversion is falsely claimed.


## UX-1 preserved integration checkpoint

Member 111 tests (106 preserved +5 design-system), real Member HTTP/DB Golden201 assertions x2, Server-confirmed Qualification switching +clear ball feedback, Dashboard/Organization/Bonus shared UI; current order/notification/profile/repurchase/logout connected flows unchanged. No API/auth/monetary changes. Visual mock fixture != Connected/Production verification; formal LIFF/Entra/UAT remain pending. Details ../ux/REPORT.md.

UX-1 source checkpoint: 5a05c3c9b722555955175451cbfa7db832681677; pushed origin/integration/member-backend-mvp. Final screenshot metadata is captured against this committed source. Follow-up evidence update changes documentation/reference metadata only.

UX-2 six-screen refinement: Member tests 112 PASS; Admin 18 PASS; isolated Member/Admin HTTP-DB 219 assertions PASS. Visual Member fixtures are MOCK ONLY, separate from Connected gates. Formal LIFF/LINE, Entra and UAT pending; Production BLOCKED. Report: ../ux/ux2/REPORT.md.
