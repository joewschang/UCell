# Member Connected DEV integration matrix

Date: 2026-09-16. Branch: integration/member-backend-mvp. Production remains BLOCKED.

| Area | Connected DEV evidence | Status / limit |
|---|---|---|
| Backend LINE verification | Official-provider adapter; 7 core tests; synthetic isolated HTTP boundary | PASS engineering; formal credentials BLOCKED |
| Member opaque session | Exchange, duplicate, invalid, unbound, expiry, disabled Person, Admin rejection | PASS isolated HTTP |
| Qualification switching | Two owned balls allowed; foreign/forged/missing context denied; switch back deterministic | PASS isolated HTTP |
| Dashboard/performance | Ball 1 11/2400/1680; Ball 2 23/1200/480; unsettled bonus null | PASS TEST_ONLY Core fixture |
| Sponsor/Binary/referrals | Sponsor counts 2/0, Binary left 1/2; independent relations | PASS isolated HTTP |
| Bonus/ledger | Real persisted facts, pending semantics; ownership denial | PASS adapter; non-empty full journey pending |
| Repurchase | Scoped schedule read | API and Dashboard schedule-derived status PASS |
| Products | Real product reference; unknown ERP inventory closed | Read available; purchase flow pending |
| Orders/detail | Owned query and foreign detail denial | GET PASS; POST auth/DTO implemented but 422 PENDING_DECISION; no purchase success |
| Notifications | Persisted audience-scoped GET + real UI | PASS isolated; LINE push/read sync/publisher pending |
| Profile | Own display/contact PATCH, audit and real edit form | PASS HTTP/DB + UI tests; no legal/identity mutation |
| Member build/tests | Build + 91 tests | PASS; not browser E2E |
| Frontend real contract | Actual Ball 1 and Ball 2 HTTP bundles validated | PASS |
| Admin integration | DEV entrypoint loads MemberModule without DEV principal assignment | Build + 43 HTTP PASS; 4 unauthenticated Member operations return 401 |
| OpenAPI | Export/preflight, exchange request DTO, Member auth | PASS basic; full response schema audit pending |
| Golden journey | 111 HTTP/DB assertions per fresh isolated run, two runs | PASS synthetic provider; full browser journey pending |
| Production Security/UAT | Formal credentials/configuration not available | BLOCKED |

No synthetic token provider or mock data enables production authentication. UI mock mode remains restricted to pure UI DEV; Integration/UAT require VITE_ENABLE_MOCK=false. Pending Decisions remain eligible scope, formal PV/BV mapping, production calendar/cut-off.
