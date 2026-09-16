# Backend Binary / Referral TODO continuation — 2026-09-16

Pre-change checkpoint 40ec4f9; branch integration/member-backend-mvp. This batch converts 17 original Bonus Engine TODOs through actual service calculation/query/write assertions: six Binary, ten Referral/Equalization and one initial lifecycle case. Following the earlier three-case Matching batch, the shared working tree now has 52 TODO (69 → 52). One prior v064 conversion remains concurrent uncommitted work; do not interpret this shared-working-tree count as clean-checkout release certification.

Final verification: focused 24 PASS / 2 TODO; complete API 17 suites / 130 PASS / 52 TODO; TODO gate exit 1 correctly BLOCKED; whitespace validation PASS. Actual historical Binary path, archived Sponsor/Active state, independent per-source Equalization base, plan rates/caps, carry and K0/K1 behavior are exercised. Persistence and sealSettlement are mocked; this does not complete DB concurrency, temporal SQL, sealing or period replay/carry convergence. Business rules and production services remain unchanged. Both inactive-Binary no-row/zero-marker interpretation and real Matching Sponsor traversal remain unresolved TODOs. Production Promotion remains BLOCKED.

Current batch [report](batches/binary-referral-20260916/REPORT.md), [gate matrix](batches/binary-referral-20260916/PASS-FAIL-MATRIX.md) and [complete working-tree TODO inventory](batches/binary-referral-20260916/TODO-INVENTORY.md) supersede older Backend TODO counts only. Earlier UX/Member/API evidence below remains historical. The historically withdrawn 52-TODO claim is still invalid; this coincidental new count has separate explicit evidence and makes no claim that all 96 net reductions are release-reviewed.

---

# Member / Admin functional gap closure — 2026-09-16

Branch integration/member-backend-mvp; pre-change checkpoint d4f0e99. This section supersedes preceding Member counts and records the additional Admin UI/transport closure. No main merge, force push, RC2 or Production promotion.

Verified source/evidence checkpoint: 8a6dd75ec3028c15e5ffdda2fc0e0fbcce00c865, pushed and confirmed on origin/integration/member-backend-mvp. The following documentation-only commit records this immutable SHA. Final gates contain PASS/BLOCKED and no unresolved FAIL. Local Admin API/Worker restored; temporary mock browser test server stopped.

CODE COMPLETE: existing Connected Member MVP plus server-confirmed Ball switching, zero-Qualification account access, Core repurchase details and UCell server-session revocation. Specific Admin fixes: typed subscription reads, retry/concurrent submission transport, stale-session cache isolation, server remaining return quantities, Core monetary display/aggregates, query/error/empty/retry, exports and 404.

CONNECTED DEV PASS: Member 106 tests, Backend API 106 tests, isolated Member HTTP/DB 201 assertions twice, replay DB 129 assertions, Admin 11 tests, actual Admin 49 HTTP operations, four direct unauthenticated Member denials and five-screen UI/API smoke (13 real responses). Builds include Backend/Worker/Admin/Member; Prisma validate/generate/deploy and 22 existing migrations PASS. OpenAPI, both real frontend contracts, static/schema/security policy/preflight PASS. Member mobile browser smoke PASS only against explicitly mock UI: seven routes, 320/390/768px, no network writes. It is not formal LINE UAT.

OPERATIONAL CREDENTIAL PENDING: formal LINE/LIFF device login and Entra/RBAC validation. UAT PENDING: real browser/device Golden Journey, operating configuration and signoff. PRODUCTION BLOCKED: 73 TODO, incomplete Backend replay/carry/scheduling, formal Security/UAT and remaining release/backup/restore/workload evidence. RC/release/security/UAT gates remain correctly blocked.

## APIs / migration / files

Added POST /api/v1/member/logout: authenticated current session only, no submitted identity/session/Qualification ownership; Idempotency-Key, transactional revocation/audit. Subsequent delivery with a revoked bearer returns 401, other sessions remain active. Added GET /api/v1/admin/subscriptions with bounded take, Qualification/status validation and deterministic ordering. Admin GET order detail now returns returnedQuantity/remainingReversibleQuantity from cumulative POSTED return facts within RepeatableRead. Return queue monetary aggregate is calculated by Core Decimal read model, not the browser.

New Product profiles capture their effective R1.0B parameter hash and require timezone configuration. Existing profiles are never retrospectively filled/overwritten. An attempted existing GPV rate change now fails closed VERSIONED_PRODUCT_PROFILE_REQUIRED instead of silently ignoring input; the whole price/name write rolls back. This is validation/traceability, not approval of a new rate or formal PV/BV mapping. Member Golden product is created through actual ProductService, proving Admin-to-Member configuration compatibility.

No new migration or dependency/lockfile changes: total 22 migrations. Source changes include Admin app/auth/api/commands/query feedback/orders/returns/products/reports/subscriptions/payout display, additive Backend Member/Order/Product/Subscription/AdminOperations reads, Member context/account/repurchase/logout adapters and UI, OpenAPI and actual regression/browser tests. Full file list/diff is in the checkpoint. Details: UI-FUNCTION-INVENTORY.md.

## Tests / execution / findings

Logout tests inject audit failure after session mutation, assert session/key rollback, retry success, single audit, revoked bearer denial, concurrent delivery and unaffected other session. Product test rejects unapproved existing-rate changes and verifies original profile and price are unchanged. Admin actual HTTP asserts cumulative remaining quantities, server return total, subscription isolation and invalid filter limits. Transport tests cover lost response retry/coalescing, actor changes, real headers/body, timeout and 401/403. Member switching tests hide private data while verifying, deny wrong responses and abort late unmounted attempts.

Frontend initial rerun exposed a test hook returning a mock function; Vitest registered it as cleanup and waited on an unresolved Promise. Fixed the hook, retained every case, cleaned only verified test process trees and reran normal pnpm test: 106 PASS, no runner workaround or skipped tests. Initial browser attempts exposed missing bundled Chromium and a Linux /tmp default; local installed Edge can be selected explicitly and screenshot temp path now uses os.tmpdir. Initial attempts/evidence retained in final logs; final gate matrix has no unresolved FAIL.

Exact commands/timestamps/exits: final/gate-results.json and raw logs. Executed selected run-gates batches for Prisma, all builds/tests, fresh DB Golden twice, replay, contracts, OpenAPI, policy/static/security/UAT/TODO/RC/release checks, live Admin HTTP, Member unauthenticated denials, real local Admin UI and mock Member mobile browser. Local API/Worker restored after Prisma/release tests.

## Remaining unfinished functions / next stage

Admin subscription creation/cancellation is not completed by this read page: legacy Backend UTC schedule construction, versioned scheduling configuration, cancellation retry/rollback and formal operational configuration remain required. Read page deliberately does not expose those unverified writes. Product legacy missing snapshots stay configuration pending; no current-state historical fallback. Backend K1/K2 complete period-wide replay, carry convergence/maxWeeks/resume and 73 executable TODO remain. TODO trajectory 148 → 74 → 73 → 73 for this UI batch; new UI/security cases are additional coverage, not disguised TODO conversion.

Pending Decisions unchanged: eligible-consumption scope, formal PV/BV event mapping, production calendar/cut-off. Payment gateway/ERP fulfillment/LINE push are future external scope, not fabricated MVP success. Next engineering stage remains ordered Backend replay/carry/scheduling/TODO work; formal credentials enable device Security/UAT verification independently.

Previous reports below are historical checkpoint records.

---
# Connected Member MVP closure checkpoint — 2026-09-16

Branch: integration/member-backend-mvp. Pre-change checkpoint b64a31a; preserved implementation checkpoint 1639bd5. This section supersedes older incomplete Member entries below. Production Promotion remains BLOCKED; no main merge, force push or RC2 promotion.

Verified source/evidence checkpoint: 107cd9c71b0c094be049c7ca3b4f124a47efa7fd, pushed to origin/integration/member-backend-mvp and confirmed by ls-remote. The following documentation-only commit records that immutable SHA. All final matrix gates are PASS or explicitly BLOCKED; no unresolved FAIL result remains. Local DEV API/Worker were restored after Prisma/release checks.

## Status classification

- CODE COMPLETE: Connected Member MVP API/UI infrastructure for Core-priced order creation/detail, station notification read-state, own Person contact/profile, Core repurchase Dashboard, scoped views and error/session states. Backend Phase 3 is NOT complete.
- CONNECTED DEV PASS: Backend/Worker/Admin/Member builds; Prisma validate/generate/deploy; fresh isolated Golden twice; Member tests and actual API/DB journey; BOLA/IDOR; OpenAPI response/authorization/input schemas; policy/static and replay checks. Exact final counts/results are authoritative in final/PASS-FAIL-MATRIX.md and raw logs.
- OPERATIONAL CREDENTIAL PENDING: formal LINE channel/LIFF credentials and real-device verification; formal Entra/RBAC verification. Synthetic provider boundary is test-only, never a Production PASS.
- UAT PENDING: authenticated LIFF browser/real-device Golden Journey and operational signoff/configuration remain unavailable. API journey does not substitute for browser UAT.
- PRODUCTION BLOCKED: 73 executable TODO plus formal Security/UAT, backup/restore, operational configuration and complete release evidence. RC/release gates remain blocked.

## Changes / migration / APIs / UI

POST /api/v1/member/orders now delegates to authoritative Core OrderService in a Member-specific Serializable/idempotent path. Server revalidates temporal ownership, active product and a single effective traceable R1.0B rule profile. Client supplies only Qualification and item IDs/quantities; price, PV and purpose fields are rejected. Order confirmation means recorded order, not payment, fulfillment or PV recognition. Missing configuration fails closed; pending formal PV/BV event mapping remains unresolved. Decimal order prices come from Backend; frontend does not sum monetary results. Duplicate payload/key returns original order even after product-price changes; conflicting payload returns 409. No original Ledger/award/PAID mutation occurs.

PATCH /api/v1/member/notifications/:id/read adds first-read evidence scoped to authenticated Person and owned ball. PATCH /api/v1/member/profile is idempotent and audited in the same transaction; only preferred name/email/mobile are writable, strictly Person-level. Both require Idempotency-Key. GET notifications returns persisted readAt. MEMBER_ORDER_CREATED transactional outbox consumer appends station notification and acknowledges its lease atomically; duplicate delivery preserves the original notice. No LINE push or ERP fulfillment scope is introduced.

Migration 20260916040000_member_notification_reads (22nd migration) adds composite owner-bound read evidence and unique source-event notification identity. No monetary schema/lifecycle rewrite.

Member Shop uses Core product/order API; order detail is fetched after success. Failed submission retains cart and key for retry; duplicate clicks are guarded. Profile and notifications use real PATCH/read-state. Dashboard repurchase is Core status. Loading/empty/error/403/409/422/expired-session states are covered; mock mode stays UI-only. OpenAPI includes request/response envelopes, nullable pending amounts, pagination, bearer/context errors and required mutation keys.

Read adapter correction: same-time Core CALCULATED → PENDING_45D events no longer use random UUID ordering to hide a held award. Only this established initial transition is resolved; other conflicting chronology fails closed LIFECYCLE_EVIDENCE_AMBIGUOUS. No amounts or historical lifecycle are modified. Added non-empty Bonus/Ledger isolation and forced-timestamp-tie assertions.

## Validation / commands / security

Final verified counts: Member 99 tests; isolated Member HTTP/DB 183 assertions ×2; Backend API 106 passed / 73 TODO; replay DB 129 assertions; live Admin 43 HTTP operations and Member unauthenticated denial 4 operations. Admin first rerun lacked a running Worker and correctly failed missing historical evidence; restoring the Worker made the complete rerun PASS. Both runs remain archived.

Executed commands and exit codes: final/gate-results.json and per-gate logs. Runner: node governance/phase3-connected-dev/run-gates.mjs (selected reruns after the latest correction). Commands include Node/pnpm/git checks, Prisma validate/generate/migrate deploy, all builds, Jest/Vitest, db:golden twice, phase2-db-test, LINE verifier/session tests, contracts, OpenAPI, Security/preflight, TODO/RC/UAT/release gates and live Admin/Member auth checks.

Golden journey uses actual Nest/Prisma/Core with isolated TEST_ONLY fixtures and synthetic LINE boundary: Person login, Ball1 views, Ball2 distinct volumes/trees/bonus/ledger, foreign ownership denial, products/order/detail, notification/read, profile, return to deterministic Ball1. Mutation regressions prove same-key retry, conflict/concurrent delivery, audit failure rollback and subsequent retry. Outbox ack failure rolls back notice and schedules retry; LINE session creation failure rolls back token consumption. Raw result evidence is final/member-contracts/member-journey.json; no tokens are recorded.

Security findings resolved: authoritative server prices/ownership, forbidden monetary inputs, notification audience isolation, profile identity/Qualification field rejection, real Member guard even on Admin DEV. Formal Security E2E remains blocked, not passed with fabricated principals.

TODO burn-down: 148 → 74 → 73. One existing RPV anchor-type TODO became a real regression backed by DB recovery evidence; replay assertions increased 128 → 129. No TODO deletion/skip/fake assertion. Detailed remaining cases: final/TODO-INVENTORY.md.

Pending Decisions remain eligible-consumption complete scope, PV/BV formal event mapping, production operational calendar/cut-off. Asia/Taipei and historical snapshot fail-closed are settled.

Next stage: ordered RPV concurrency and K1/K2 period-wide replay, carry convergence/maxWeeks/resume, qualification/subscription/Golden workload TODO batches. Formal LINE device/UAT testing requires operational credentials. This checkpoint is Member engineering closure, not Backend Phase 3 or Production completion.

Changed-file and diff evidence: git checkpoint diff; source includes Member services/controllers/DTOs, OrderService/module, notification consumer/Worker, Prisma migration/schema, Member Connected UI/auth/data adapters, actual regression tests, OpenAPI and governance evidence. rc1-recovered remains the shared baseline.

---
# Member continuation checkpoint — 2026-09-16

Branch: integration/member-backend-mvp. Pre-change checkpoint: bdac653. This stage completes Connected station-notification reads and own profile/contact editing; full LINE OA/LIFF rollout, checkout and Backend Phase 3 remain incomplete. Production Promotion = BLOCKED. No main merge or force push.

## Changes / APIs / UI

- GET /api/v1/member/notifications: persisted Person-addressed notices plus selected owned ball notices, maximum 100, newest-first, explicit pagination limit/truncated. Foreign/forged/missing context fails closed. This is station notification storage/read only; no LINE push, publisher workflow or synchronized read status is claimed.
- PATCH /api/v1/member/profile: own display name, Email and phone only; server rejects Person/status/qualification/monetary fields, nulls, blank/invalid input. Person update and audit append share a Serializable transaction. Legal name, identity mapping and monetary facts remain unchanged. Contact data does not authorize login or bind LINE identity.
- POST /api/v1/member/orders: Member auth, ownership, Idempotency-Key and DTO validation are implemented, but checkout fails closed 422 PENDING_DECISION. Existing Admin OrderService CONFIRMS an order and seals rule mappings; it is not exposed to Members without formal mapping/checkout configuration. No purchase success, order creation, payment or award mutation is fabricated.
- Member notification center consumes true Backend envelopes in real mode. Profile form saves real contact/display edits, preserves values on failure, refreshes own data and clears submitted fields on success. Mock mode does not update real profiles.
- Member default displayed query month uses Asia/Taipei. Dashboard repurchase status reads the selected business month's Core recognition schedules instead of a fixed PENDING placeholder. This does not construct or approve a production operational calendar.

## Migration / tests / evidence

Migration 20260916030000_member_notification adds integration.member_notification with Person/Qualification foreign keys, category CHECK and audience/date index. Total migrations: 21. No ledger/award/PAID schema mutation. Local Prisma validate/generate and DEV/default regression DB deploy PASS; isolated Golden deploys migrations independently into fresh disposable databases.

Member tests: 12 files / 91 tests PASS. Isolated Member journey: 111 HTTP/DB assertions, including the preceding identity/two-ball/BOLA journey plus notification audience isolation, profile tampering/null/invalid input rejection, persisted legal-name invariance, one successful audit, no monetary mutation, explicit missing-snapshot 422/code and disabled checkout repeat/no-order evidence. LINE provider boundary remains synthetic only in the test application; formal credentials NOT VERIFIED. Two independent Golden runs PASS at 111 Member assertions each and are recorded in final gate logs. Fresh Admin HTTP rerun PASS (43 operations); four actual Local DEV Member HTTP operations without Member bearer all return 401. Release/TODO/RC/UAT/formal Security remain BLOCKED; latest matrix has no unresolved FAIL gates.

Backend build includes Worker; Admin/Member/DEV builds, API 105 Jest tests, replay 128 assertions, frontend contract bundles, OpenAPI export/preflight and policy/static/domain gates are recorded in final/PASS-FAIL-MATRIX.md. Initial Member test failure asserted the superseded real-mode placeholder; it was changed into an actual API-response/scoped-request/no-mutation assertion, preserving the test. Initial Prisma Windows DLL lock failures remain archived; generation/release checks must run without live DEV engine holders or concurrent DB tests.

Commands: git status; git checkpoint commit; Prisma validate/generate/migrate deploy via run-gates; pnpm Backend/Admin/Member build; pnpm Member test; API Jest; isolated DB Golden twice; replay regression; contract verification for both balls; OpenAPI export/preflight; static/schema/migration/source/security/domain/preflight/TODO/RC/UAT/release commands. Exact commands, timestamps and raw output are in final/gate-results.json and per-gate .txt logs. No deployment to production.

## Security / TODO / blockers / next stage

TODO trajectory remains 148 → 74 → 74. The new Member tests are additional coverage, not renamed/removed TODO conversions. K1/K2 complete period-wide replay, carry convergence/maxWeeks/resume and remaining audited Phase 3 TODO batches are still required.

Security evidence proves Member ownership at Backend, notification audience isolation, own profile-only mutation and client monetary input rejection. Formal LINE/Entra, provider/session/browser E2E, UAT/signoff, backup/restore, production workload and complete non-empty payout/return/clawback release evidence remain BLOCKED or incomplete. Local synthetic-boundary evidence must not be presented as formal LINE/Production PASS.

Pending Decisions: eligible-consumption complete scope, formal PV/BV event mapping, production operational calendar/cut-off. Checkout remains blocked by its unresolved formal configuration; unaffected reads/profile/notification work continues. Next work: richer OpenAPI DTO/pagination, notification publication/read-state policy, authenticated browser Golden Journey with real LINE credentials, approved checkout configuration, and ordered Backend replay/carry/TODO completion. Unified Member takeover remains active; do not assign another agent to modify member/.

Prior sections below record preceding checkpoints and are superseded only where this continuation explicitly replaces their unfinished items.

---
# Integrated MVP checkpoint — 2026-09-16

Active branch: integration/member-backend-mvp. Production Promotion remains BLOCKED. This is an integration foundation checkpoint, not completion of Phase 3 or RC2.

## Preservation and authority

Fetched origin before integration. Remote Member HEAD was 2d5f6067077f74b51f86ea3a8057a25e159ad8d7 (v0.6.0), newer than the supplied v0.2 checkpoint 461de2b78e65f71e1497b4fb7e56850417663884. Both that checkpoint and verified Backend e8fee4f2ac21855fab1a2720818f0383c0537676 remain ancestors of integration merge 7915d1af21f3c50964de6cdc9c2b40a3c4f16d6e. Checkpoint 73bb928 was pushed before integration. Subsequent implementation checkpoints are recorded in git history. rc1-recovered remains the shared baseline. No main merge, force push or verified-work reset.

Latest unified takeover supersedes previous member/ edit restriction. No other agent is assigned Member changes. R1.0B business semantics remain frozen. SSOT: reported documents > officially approved documents > formal R1.0/R1.0B specifications > SA decisions > legacy records/tests.

## Implementation

Added MemberModule to production and Local Admin DEV entrypoints. Member requests bypass only the Admin DEV actor assignment and still require their own LINE-backed opaque session and temporal Qualification ownership. Suspended Persons and Admin credentials are denied. Server-side LINE verification precedes identity mapping; no client profile/userId trust or automatic account binding. Token exchange is single-use by SHA-256 idempotency evidence, with Serializable conflict handling. Raw LINE tokens are not stored in browser storage; only the opaque UCell session is retained.

Added auth/member/line/exchange; member/me, qualifications, context/qualification, dashboard, organization/sponsor, organization/binary, referrals, performance, bonuses, bonuses/ledger, repurchase/status, products, orders and orders/:id. All scoped reads validate Person ownership on the server. Missing context returns 422 QUALIFICATION_CONTEXT_REQUIRED; foreign/forged context returns 403 QUALIFICATION_NOT_OWNED; foreign order detail returns 404. Swagger export includes the new routes and exchange DTO/authentication.

Reads use Core persisted facts. Sponsor and Binary representations are independent. RPV/EPV require sealed historical evidence. Effective volume attributes later reversal events to original event month. CALCULATED or unfinalized awards remain PENDING/null and are not exposed as posted ledger entries. Dashboard unsettled bonus remains null. Unknown Binary volume remains null. Product inventory is closed pending ERP evidence. No formal eligible scope or PV/BV event mapping is inferred from TEST_ONLY fixtures.

Member LIFF bootstrap now exchanges the ID token with Backend and validates cached UCell sessions. Vite DEV proxies /api to the local API. Existing pages use real adapters when VITE_ENABLE_MOCK=false. Notifications/profile writes/order creation and complete real-browser journey remain unfinished; mock UI tests are not UAT evidence.

## Verification and evidence

Backend build (including Worker), Admin build, Admin DEV build, Member build PASS. API 105 Jest tests PASS; 74 executable TODO remain. Member 89 tests PASS. LINE verifier core 7 and Member authentication core 8 tests PASS. Two fresh isolated DB Golden runs each include 87 new Member HTTP/DB assertions, 20 historical RPV concurrency, 81 membership and 20 Return/outbox assertions. Replay regression 128 assertions PASS. Actual Ball 1/Ball 2 HTTP bundles pass Member runtime contract validation.

Golden journey uses a synthetic LINE verification boundary in an isolated test application, actual opaque sessions, actual Prisma DB and actual Core services. Ball 1 PV/RPV/EPV = 11/2400/1680; Ball 2 = 23/1200/480. Sponsor counts = 2/0; Binary left counts = 1/2. Switching back restores original results. Foreign-ball direct API, forged context, missing context, expired session, Admin session and suspended Person are denied. Repeated reads leave monetary counts unchanged. Formal LINE provider credentials are NOT verified.

Prisma validate/generate/migrate deploy PASS on local DEV databases; fresh Golden independently deploys all 20 migrations. No new migration in this checkpoint. Initial preflight failed because live DEV processes held Prisma DLL; stopping those exact processes restored preflight PASS. Initial failures are retained under final/initial-attempts. Never interpret retained older gate timestamps as a new run.

Executed commands and exact timestamps/results are in final/gate-results.json and per-gate logs. OpenAPI export/preflight also PASS. Fresh Admin DEV HTTP rerun PASS (43 operations); direct Member me without a Member bearer returns 401 even in Admin full DEV mode. Consult final/PASS-FAIL-MATRIX.md and MEMBER-INTEGRATION-MATRIX.md. Source changes are under Backend auth/member modules, admin-dev/AppModule wiring, isolated DB Golden script, Member LIFF/tests/Vite, OpenAPI export and governance runner/evidence. git diff/stat and commit history are authoritative for the complete file list.

## Remaining blockers and next work

TODO progression: 148 → 74 → 74. This batch adds tests; it does not claim TODO conversion. RPV historical concurrency coverage is established; K1/K2 complete period-wide replay, carry convergence/maxWeeks/resume, remaining Qualification/subscription/golden-flow TODOs and production consumer workload still need completion. Subscription scheduling must use versioned Asia/Taipei configuration without inventing an operational calendar.

Member order writes/profile/notifications, richer OpenAPI response schemas/pagination, cross-period return UI evidence, full Member browser E2E and full integrated Golden flow are incomplete. Dashboard repurchase status currently remains conservative PENDING and needs actual schedule-derived integration. Formal Entra/RBAC, LINE credentials, Security E2E, operational UAT/signoff, backup/restore drill and non-empty payout/full clawback evidence remain blockers. Security Policy Preflight PASS is not Production security PASS. Release/TODO/RC gates remain BLOCKED.

Pending Decisions remain eligible-consumption complete scope, PV/BV formal event mapping, production operational calendar and cut-off. Continue engineering work independently; fail closed only affected features. Next ordered Backend stage: K1/K2 period-wide replay, carry convergence/maxWeeks/resume, then audited TODO batches, alongside Member write/read completion. Commit and push each stable checkpoint to origin integration/member-backend-mvp.

Previous chronological reports below are historical evidence; their earlier branch/member coordination instructions are superseded by this unified integration section.

---
# Phase 3 Connected DEV progress report

Date: 2026-09-15–16 (Asia/Taipei). Active Backend branch: `codex/backend-phase3`. Production Promotion remains BLOCKED; no RC2, merge, force push or production promotion.

## Phase 3 ordered continuation

Latest user direction creates `codex/backend-phase3` from verified checkpoint `9c6fbee7c7856fae329b99e74e883608641a1a9b`, which was pushed to origin before changes. This supersedes the earlier active Phase 2 branch choice below. All subsequent stable checkpoints on Phase 3 must update REPORT, PASS/FAIL Matrix and TODO inventory and push normally. Do not modify `member/`; Member API cooperation remains additive. Local `rc1-recovered` remains at shared baseline `63b9a21c0ff328a2a38521f69e3896bd328aa990`.

First priority extends the isolated RPV concurrency fixture to historical recipients: inactive G1 remains zero, Active G2 earns 100 without compression. After recognition, current Binary parent is replaced and Active states change. Two controlled concurrent historical cancellation replays must produce one committed action and a retryable Serializable/unique conflict; explicit redelivery retains one posting per historical recipient, one 100 recovery and one -1200 reversal. Current replacement receives no recovery, and complete original recipient awards/snapshot remain unchanged. The suite now has 20 assertions; fixture rates/time are TEST_ONLY and no operational calendar/scope decision is inferred. No production source/migration changes. TODO inventory remains 74.

Remaining ordered work: K1/K2 period-wide replay, then carry convergence/maxWeeks/resume, then further audited TODO conversions. These are not claimed complete by the RPV fixture. Asia/Taipei, historical fail-closed and Legacy Test Drift are already decided; eligible scope, PV/BV formal mapping and production calendar/cut-off remain Pending Decision. Build/Prisma/offline/formal Security/UAT/release-preparation timestamps retain preceding evidence for this test-only batch.

Phase 3 historical recipient batch verification: two independent fresh Golden runs PASS, each including 20 RPV concurrency assertions, 81 membership assertions and 20 Return/outbox assertions. API 16 suites / 105 tests PASS / 74 TODOs; replay regression 128 assertions PASS; Security Policy Preflight PASS; Admin DEV 43 HTTP requests PASS; diff check PASS. Backend/TODO/RC gates remain BLOCKED by TODOs; formal Security/UAT and Production Promotion remain BLOCKED. REPORT/matrix/inventory are committed and pushed together; exact commands/timestamps/raw output remain in `final/gate-results.json`.

## Backend branch coordination checkpoint

User-authorized branch split: verified work through `6faf1f4edc7e65543fa77b903a89ece4b661101b` is preserved by checkpoint `63b9a21c0ff328a2a38521f69e3896bd328aa990`. Local `rc1-recovered` remains at this shared stable baseline; subsequent Backend work proceeds on `codex/backend-phase2`. The target branch was absent on origin when checked before creation. Publish this checkpoint/report using normal `git push -u origin codex/backend-phase2`; verify remote HEAD after push. Do not move or push `rc1-recovered` as part of the branch split.

For subsequent stable checkpoints, update this REPORT with changed files, commands, gate outcomes, remaining blockers and checkpoint evidence, commit on `codex/backend-phase2`, and push to origin without force. `feature/member-liff-mvp` is parallel Member LINE OA/LIFF work: do not modify `member/`. Backend cooperation with Member API Contract must use additive API implementation, preserving existing contracts. No new test run or expanded PASS claim is made by this documentation/branch-only checkpoint; earlier per-gate timestamps remain authoritative.

Default DEV DB Golden now creates a fresh local `ucell_dev_golden_<uuid>` database, deploys all 20 migrations, loads deterministic five-person/five-qualification fixtures, checks exact fixture counts and frozen pool values, executes timezone/concurrency regression, and removes only its successfully-created test database. Two independent runs passed. It no longer requires pre-existing manual Golden data in the default DEV database.

RPV sealing includes original recognition period UTC bounds plus its historical accounting timezone. Replay verifies original event identity, recognition timestamp, Qualification, Binary path, Active/direct-count evidence, Parameter snapshot and complete recipient allocation. Missing evidence produces `HISTORICAL_SNAPSHOT_MISSING`; no current-state fallback is introduced. A changed current Binary parent receives no historical recovery, and original RPV awards remain unchanged.

Idempotency now checks a transaction-visible unfinished record's request hash before executing work. Regression covers the prior conflict hole. Real parallel transactions in the isolated Golden DB prove one committed entity/idempotency record; serialization/uniqueness conflicts require external redelivery and then return the original result. Injected partial failure rolls back entity/outbox/idempotency together, followed by successful retry and duplicate-delivery verification. This evidence does not claim automatic retry inside the service or complete concurrent monetary Return replay coverage.

## Latest concurrent RPV recognition batch

Checkpoint `4e64446` precedes a new isolated Golden RPV regression. A controlled barrier lets two real Serializable transactions read the same SCHEDULED recognition before proceeding. Eight DB assertions require one committed delivery, a P2034/P2002 conflict for the losing delivery, successful external redelivery as ALREADY_RECOGNIZED, one exact 1200 original ledger event, committed event identity in both sealed snapshot and schedule, and complete snapshot retention on duplicate. The fixture has no uplines; it does not claim concurrent recipient-award allocation coverage. It uses explicit TEST_ONLY dueAt/plan/source histories and does not approve an operational calendar.

No production defect is assumed or repaired: the existing Serializable transaction is tested with explicit external redelivery rather than claiming automatic internal retry. No TODO is converted by this additional concurrency regression; inventory remains 74. Default fresh Golden now invokes this gate in addition to 81 membership and 20 Return/outbox assertions. This test-only batch retains preceding build/Prisma/offline/formal Security/UAT/release-preparation timestamps.

Concurrent RPV batch verification: API tests and both fresh isolated Golden runs PASS; each Golden run executes eight new concurrent recognition assertions alongside the existing suites. Replay DB regression remains 128 assertions PASS; Security Policy Preflight PASS. No duplicate recognition defect was reproduced: the losing Serializable delivery fails and explicit redelivery returns ALREADY_RECOGNIZED. Concurrent RPV recipient-award allocation remains unverified by this no-upline fixture.

Final focused results: 16 suites / 105 Jest tests PASS / 74 TODOs; Admin DEV 43 HTTP requests PASS; diff check PASS. Backend/TODO/RC gates remain BLOCKED by TODOs; formal Security/UAT and Production Promotion remain BLOCKED. Commands/timestamps/raw output are recorded in `final/gate-results.json`.

## Latest RPV recognition batch

Checkpoint `bce1d46` precedes two vertical-slice-02 TODO conversions for due RPV recognition and duplicate recognition. Five direct DB assertions use actual RpvService and Prisma to verify exact 1200 RPV original ledger/source/Qualification/dueAt identity, RECOGNIZED schedule event/month identity, ALREADY_RECOGNIZED duplicate response, every original award row and the entire archived historical snapshot unchanged. Existing event-count assertion requires exactly one original RPV event. Jest writes its own temporary evidence file to avoid shared-output reads. The TEST_ONLY dueAt and consumption fixtures do not approve operational calendar or eligible scope.

Current TODO inventory is **74** (prior 76, original baseline 148, net reduction 74); replay DB regression increases from 123 to 128 assertions. No production source/schema/business rule changes. Build/Prisma/offline/formal Security/UAT/release-preparation and isolated Golden entries retain preceding timestamps; exact current reruns are in the matrix.

RPV recognition batch verification: 16 suites / 105 Jest tests PASS / 74 TODOs; 128 DB regression assertions PASS; Security Policy Preflight PASS; Admin DEV 43 HTTP requests PASS; diff check PASS. Backend/TODO/RC gates remain BLOCKED by TODOs; formal Security/UAT and Production Promotion remain BLOCKED. Exact commands/timestamps/raw output are in `final/gate-results.json`.

## Latest direct Qualification batch

Checkpoint `57ca3c9` precedes two vertical-slice TODO conversions using actual QualificationService, OrganizationService and IdempotencyService: Qualification creation with permanent Sponsor sequence, and first direct RIGHT rejection before any Qualification/history/tree/audit writes. Stateful service tests verify duplicate identity, initial holder/plan history, separate Sponsor/Binary placement and sequence progression across an explicitly closed TEST_ONLY relationship. They do not claim mock persistence implements slot occupancy or transaction rollback.

Ten fresh Golden DB assertions independently invoke the actual direct-create services: invalid first RIGHT leaves qualification count unchanged; first sequence is one; duplicate returns the same Qualification and one Sponsor row; second sequence is two with a different Binary parent; closing that TEST_ONLY Sponsor interval does not reuse sequence two, and third sequence remains three within the Sponsor LEFT subtree. No formal exit workflow semantics are inferred. Isolated membership assertions increase from 71 to 81; replay DB regression remains 123. TODO inventory is 76 (prior 78, baseline 148, net reduction 72).

This batch changes tests/fixtures only. Build/Prisma/offline/formal Security/UAT/release-preparation entries retain preceding timestamps; exact current reruns are recorded in the matrix.

Direct Qualification batch verification: 16 suites / 103 Jest tests PASS / 76 TODOs; two fresh Golden runs PASS, each including 81 membership/temporal/payout/maturity/direct-create and 20 Return/outbox assertions; replay DB regression 123 assertions PASS; Security Policy Preflight PASS; Admin DEV 43 HTTP requests PASS; diff check PASS. Backend/TODO/RC gates remain BLOCKED by TODOs. Formal Security/UAT and Production Promotion remain BLOCKED. Exact commands, timestamps and logs are in `final/gate-results.json`.

## Latest replay correction/recovery batch

Checkpoint `1c03647` precedes three v060 TODO conversions: original carry-in plus historical reversal, positive compensating award and negative recovery. Six direct DB assertions extend the real cumulative K0 return fixture: exact positive award amount/source/recipient/type; captured parameter/version/pendingUntil/snapshot/action metadata; one replay lifecycle; exact negative delta/original-award recovery/remaining balance; mutually exclusive correction directions; and duplicate return preserving all posting/award/recovery counts. Both correction paths also retain the original K0 award baseline. The carry case uses historical event attribution, effective volume and original nonzero carry assertions. Fixture inputs remain TEST_ONLY, with no new rule/mapping assumption or production source change.

Current TODO inventory is **78** (prior 81, original baseline 148, net reduction 70); real DB regression has 123 assertions. Build/Prisma/offline/formal Security/UAT/release-preparation and isolated Golden entries retain preceding timestamps for this test-only batch; exact reruns are recorded in the matrix.

Replay correction/recovery batch verification: 16 suites / 101 Jest tests PASS / 78 TODOs; 123 DB regression assertions PASS; Security Policy Preflight PASS; Admin DEV 43 HTTP requests PASS; diff check PASS. Backend/TODO/RC gates remain BLOCKED by TODOs. Formal Security/UAT and Production Promotion remain BLOCKED. Exact commands, timestamps and raw output are in `final/gate-results.json`.

## Latest DB schema and ledger batch

Checkpoint `bed3413` precedes two TODO conversions: Prisma adjustment/workflow/replay model convergence and PV Ledger immutability. Five direct DB assertions compare actual information_schema columns with every scalar field mapping in generated Prisma metadata for SettlementAdjustmentBatch/Line, QualificationWorkflow and SettlementReplayRun/Period. Three direct assertions attempt UPDATE and DELETE through Prisma, require the append-only DB trigger error, roll back each rejected statement to a savepoint and compare the entire retained original ledger row. Jest uses private evidence output files; no production source, schema or monetary rule is changed. Regression now has 117 assertions and TODO inventory is 81 (prior 83, baseline 148, net reduction 67).

Legacy Test Drift retained: the existing 0005 cancellation-reference TODO refers to an earlier migration layout. Current migration 0005 explicitly defers cancellation to canonical subscription schema in migration 0006. That unresolved TODO is not removed or treated as behavioral coverage. Build/Prisma/offline/formal Security/UAT/release-preparation entries retain preceding timestamps for this test-only batch.

DB schema/ledger batch verification: 16 suites / 98 Jest tests PASS / 81 TODOs; 117 DB regression assertions PASS; two independent isolated Golden runs PASS; Security Policy Preflight PASS; Admin DEV 43 HTTP requests PASS; diff check PASS. Backend/TODO/RC gates remain BLOCKED by TODOs. Formal Security/UAT and Production Promotion remain BLOCKED. Exact commands, timestamps and raw output are in `final/gate-results.json`.

## Latest order profile batch

Checkpoint `17bc149` precedes conversion of the server-side Product Rule Profile TODO and one additional missing-profile negative test. Actual OrderService and IdempotencyService use stateful persistence mocks. Assertions cover server product price and Decimal quantity arithmetic, exact per-line profile/rates/eligibility/version/hash, active-product filter, half-open effective profile lookup at the order timestamp, duplicate response retaining its original profile after profile availability changes, one order write and transaction-local audit. Missing profile rejects before any order/payment/outbox/audit write or successful idempotency response. These are service tests, not DB rollback/concurrency or approved monetary/event-mapping policy evidence; all fixture values are TEST_ONLY.

Current TODO inventory is **83** (preceding batch 84, original baseline 148, net placeholder reduction 65). Build/Prisma/offline/formal Security/UAT/release-preparation and isolated Golden entries retain preceding timestamps for this test-only batch; the matrix records exact current reruns.

Order profile batch verification: 16 suites / 96 Jest tests PASS / 83 TODOs; 109 DB assertions PASS; Security Policy Preflight PASS; Admin DEV full flow 43 HTTP requests PASS. Backend/TODO/RC gates remain BLOCKED by TODOs; formal Security/UAT and Production Promotion remain BLOCKED. No migration or production source change was introduced. Exact commands and raw logs are recorded in `final/gate-results.json`.

## Latest vertical slice batch

Checkpoint `a6fd20a` precedes three conversions in `vertical-slice.e2e-spec.ts`: idempotent Person creation, exactly-once sequential payment confirmation and SALE_CONFIRMED outbox insertion. Tests invoke actual PersonService, OrderService, IdempotencyService and OutboxService against stateful persistence mocks. They verify unchanged duplicate response, conflicting Person payload rejection, one Person/audit, one payment/order update/outbox, another payment key rejected after PAID, exact sealed event payload/correlation and transaction-local audit. This is service-level evidence only; no concurrent DB payment or rollback guarantee is claimed. No eligible scope, monetary calculation or event mapping policy is changed.

Current inventory is **84 TODOs**, down from 87 in the preceding EPV batch (baseline 148, net placeholder reduction 64). Earlier counts below describe prior batches. The first run's mock parameter TypeScript inference error is preserved before repair at `fe783f0` and in `final/initial-attempts/api-tests.txt`; mock signatures were corrected without weakening assertions. This test-only batch retains preceding build/Prisma/offline/formal Security/UAT/release-preparation timestamps. See the matrix for current rerun evidence.

Latest batch results: 16 Jest suites / 94 tests PASS / 84 TODOs; 109 DB regression assertions PASS; two fresh DB Golden runs PASS; Security Policy Preflight PASS; Admin DEV full flow 43 HTTP requests PASS; diff check PASS. Backend test/TODO/RC gates remain BLOCKED by unresolved TODOs. Formal Security/UAT and Production Promotion remain BLOCKED. Exact commands and timestamps are recorded in `final/gate-results.json`.

## Coverage audit and TODO burn-down

The earlier report of 52 remaining TODOs / 96 completed cases is withdrawn. Several original cases were removed instead of converted, and assertions against constants or unrelated scenarios were incorrectly counted. The commits remain in history, with checkpoint `e232c92` before correction. Unverified cases were restored from `89bfed6`.

Current inventory: **74 executable TODOs** from original baseline 148. This is a net reduction of 74 placeholders, not a claim that all 74 have completed release-level review. The preceding audited Phase 3 batch converted 19 original TODOs with corresponding service/guard or direct DB assertions: idempotency (4), organization (4), qualification isolation (3), unlock-depth behavior (2), negative return/payout invariants (6). Two additional idempotency defect/rollback regression tests were added. Earlier Phase 2 conversions remain subject to continued coverage review.

The next batch, checkpoint `27789de`, converts four Vertical Slice 02 cases: DRAFT creation using the real service/idempotency callback; SUBMIT rejection for each missing Sponsor/Binary field plus successful submission; Active overlap rejection without mutation; historical Active half-open boundaries independent of the current flag. These are service tests with mocked persistence and do not claim database atomicity or concurrent Active exclusion. All other original cases remain TODO.

The following batch, checkpoint `8b44716`, converts three cases: application approval uses one idempotent transaction callback and transaction-local Qualification/Holder/Plan/Status/Sponsor/Binary delegates; the first/third-left guard is invoked before any creation; placement preview keeps different Sponsor and Binary identities. `phase3-membership-db-test.mjs` additionally invokes real services and Prisma in the fresh Golden DB to prove complete late-failure rollback, retry, duplicate approval, separate tree records, and first/third-left restrictions. Mocked callbacks now preserve the real idempotency `{value,replayed}` response envelope.

Checkpoint `b72e304` precedes two additional conversions: temporal holder authorization across the transfer boundary, and AdminRoleGuard denial for missing session, disallowed/missing role and absent endpoint policy. The isolated membership DB suite adds five temporal authorization assertions using explicit TEST_ONLY intervals; it does not infer workflow fee policy or claim Entra HTTP verification. This batch changes tests only; Prisma/offline/release-preparation results in the matrix retain their preceding run timestamps.

Checkpoint `1736321` precedes two payable idempotency conversions. Real `UnifiedPayableService.materialize` executes against stateful mocked transaction delegates; repeated BonusAward/RPV inputs create exactly one payable with the original source, recipient Qualification and amount. This is service-level idempotency evidence, not a concurrent database materialization test or approval of historical lifecycle eligibility. No production implementation changed; build/Prisma/offline/release-preparation results retain their preceding timestamps.

Checkpoint `68ae674` precedes three payout conversions: Qualification grouping despite a common Person, recovery offset without source Award mutation, and recovery bounded by payout gross so net remains nonnegative. The service tests execute `UnifiedPayableService` or `RecoveryBalanceService` against stateful transaction delegates and verify duplicate offset adds no second application. Fresh isolated DB fixtures add real payout grouping with the same holder Person, exact entry allocation and independent line amounts. TEST_ONLY inputs do not define formal PV/BV events or operational calendar.

Checkpoint `9ded574` precedes four append-only conversions in v060: original Binary settlement immutability, original Matching settlement/award immutability, cancellation retains the future recognition row, and recognized RPV receives an explicit negative reversal while its original awards remain unchanged. Four direct DB assertions were added to the existing multi-return/downstream fixture. The new Jest suite supplies its own temporary evidence output file to prevent shared report-read races; the CLI regression retains its canonical governance output by default.

Checkpoint `613ad60` precedes three carry conversions in v062: a later reversal linked to an original event is included in that event's historical week; following-period carry uses recalculated incoming carry; and original Binary carry/settlement/award records remain untouched. Three additional direct DB assertions check the event/reversal period relationship and every original carry/award row. The suite uses private evidence files. No production replay implementation or business/calendar rule changed.

Checkpoint `735608d` precedes the lifecycle batch. Real concurrent DB deliveries with a controlled read barrier reproduced duplicate maturity: two EFFECTIVE events, expected one. The failing regression was committed at `930d0e7` before repair. API serialization was checkpointed at `f88d17f`; the same unsafe path in the worker was then replaced with shared `matureBonusAward`. Both callers lock the original award row, inspect latest lifecycle and append EFFECTIVE within one transaction. Original monetary Award and pendingUntil remain unchanged. Two lifecycle TODOs become executable tests covering the due boundary, duplicate delivery, PAID no-op and original Award immutability. No pending-period or operational calendar rule changes.

The lifecycle batch reran all Connected DEV gates. Backend/Admin/shared builds and tests, Prisma validate/generate/deploy, both isolated Golden runs, replay regression and every static/offline/security preflight PASS. Security HTTP/UAT and TODO/Backend/RC/release-preparation/release gates remain BLOCKED. API/worker were restored after generation; Admin HTTP passed 43 requests on the repaired build. The expected initial Admin failure while the API was stopped remains in `final/initial-attempts/admin-dev-full-test.txt`. No new migration was introduced by this fix; the same 20 migrations were applied from zero in both Golden DBs.

Checkpoint `8f30757` precedes three EPV recipient conversions. The real service processes explicit TEST_ONLY 4800 consumption fixtures and asserts Active self 840, all five Active Sponsor generations 100.8 each, an inactive original Sponsor zero, and a Binary-only ancestor no award. The all-active Binary path remains inside the sponsor's left subtree and adds an intermediate Binary-only node, independently of the five-generation Sponsor path. Eight direct DB assertions were added; no eligible-consumption scope, production mapping or business parameter was changed. Non-REPURCHASE scope remains TODO/Pending Decision.

The latest focused Jest result is 16 suites / 91 tests PASS, with 87 TODOs. DB regression has 109 assertions with fixture rollback; the fresh Golden runner additionally exercises 20 monetary Return/outbox assertions and 71 membership/temporal/payout/maturity assertions (48 approval, five temporal, 14 grouping, four maturity). [TODO inventory](C:/UCell/UCell/governance/phase3-connected-dev/final/TODO-INVENTORY.md) records each unresolved name/file/line and its engineering or Pending Decision classification. No skip was added and original unresolved cases are retained. Exact gate timestamps and commands are in `final/gate-results.json`; Security/UAT and TODO-dependent Release Gates remain blockers. This test-only EPV batch retains preceding build/Prisma/offline/formal Security/UAT/release-preparation timestamps.

All gates were rerun in the preceding append-only batch at `601d7d7`, including Backend/Admin build, Prisma validate/generate/deploy, both fresh Golden databases, shared/Admin tests, all static/offline/security preflights and release-preparation/release gates. The DEV API/worker were deliberately stopped during Prisma generation; the initial Admin HTTP gate therefore failed while the API was unavailable. After restoration, the same gate passed 43 requests. That initial failure is preserved in commit history. The latest carry batch reruns focused tests, DB regression/Golden, security policy, TODO/Backend/RC and Admin HTTP checks; build/Prisma/offline/formal Security/UAT/release-preparation results retain their previous timestamps.

Checkpoint `350a8d2` preserves the EPV fixture/tests before repairing a test implementation defect: parallel Backend tests compared complete unordered SQL row arrays and failed when identical records arrived in a different order. Evidence comparisons now use stable primary-key ordering for Bonus/RPV awards and lifecycle rows, retaining every field and immutability assertion. The original failure is preserved in `final/initial-attempts/backend-test-gate.txt`. API tests and 109-assertion DB regression passed after repair; Backend test gate now reports only the 87-TODO blocker. No production or monetary implementation changed in this batch.

## Verification

See [PASS/FAIL Matrix](C:/UCell/UCell/governance/phase3-connected-dev/final/PASS-FAIL-MATRIX.md) and `final/gate-results.json` for exact commands, exit codes and raw logs. Prisma validate/generate/deploy, Backend/Admin build, API/shared/Admin tests, static/offline preflights, default isolated DB Golden, timezone/concurrency tests and replay DB regression passed. The first Prisma generate attempt hit a Windows DLL lock from the existing DEV API/worker; after stopping those identified local DEV processes, generate and dependency-backed preflight passed.

The latest service test's first run failed TypeScript literal inference and was corrected using the DTO's literal type. Offline preflight also exposed Legacy Static Check Drift after the outbox owner extraction: `admin-operations-preflight.mjs` now verifies worker wiring plus safeguards in the shared lease module rather than requiring those implementation tokens in the worker entrypoint. Real DB lease/return assertions remain enabled. These repairs change no monetary/business rule.

The new timezone migration was deployed to default local `ucell` and isolated `ucell_admin_test`, and also replayed from zero in fresh Golden databases. No historical snapshot, original monetary ledger or PAID lifecycle was changed by the migration.

The identified local DEV API/worker were restored after Prisma generation, using the isolated `ucell_admin_test` full-access profile. Admin DEV full flow passed 43 HTTP requests. Frontend `http://127.0.0.1:4173/`, its health proxy, and API `http://127.0.0.1:3001/api/v1/health` returned HTTP 200. This is DEV infrastructure evidence, not formal Security/UAT approval.

## Remaining blockers and next work

- 74 TODOs: continue SSOT/evidence audit and real implementation tests, especially vertical slice and bonus-engine settlement integration.
- Commit `83e5b39` adds lease-safe production consumer processing and 20 isolated real DB assertions for concurrent partial returns, rollback/retry, PAID clawback, stale ownership, expired lease and duplicate delivery. This closes the previously missing focused concurrency coverage; broader production workload verification remains outstanding.
- RPV historical data predating required snapshots cannot be reconstructed from current state; missing allocation/period/timezone evidence remains fail-closed.
- Formal partial-refund RPV month allocation requires original allocation evidence; no proportional fixed-award assumption is made.
- Security HTTP is BLOCKED: formal API port 3000 is unavailable and formal Entra role tokens are not provided. The script now emits a clear infrastructure blocker rather than an unhandled fetch exception. DEV full-access success is not Production RBAC PASS.
- UAT is BLOCKED: operational credentials/configuration and formal UAT execution evidence are unavailable/NOT_RUN. The existing UAT gate remains unchanged.
- Eligible-consumption scope, formal PV/BV mapping and production operational calendar/cut-off remain Pending Decision. Existing subscription UTC schedule construction still requires a versioned scheduling implementation without guessing cut-off policy.

## Changed files and commands

Engineering changes: historical replay validator/sealer, idempotency service, versioned timezone migration, default Golden runner/fixtures/assertions, real DB concurrency test and Security HTTP error handling. Test changes restore unverified cases and add focused service/guard/DB regression. Governance changes add Decision, this report, TODO inventory, gate runner and per-gate evidence; the old Phase 2 report now explicitly withdraws invalid later coverage annotations.

Latest maturity repair files: `packages/database/src/bonus-maturity.ts`, database index export, API BonusLifecycleService, worker main, bonus-engine lifecycle tests and isolated membership DB regression. Diff behavior: replace two check-then-append paths with one shared locked transaction, with no original monetary record updates.

Executed commands include `pnpm build` (Backend), Admin `pnpm build`, Prisma validate/generate/migrate deploy, `pnpm db:golden` twice on fresh databases, API `test:e2e --runInBand`, shared/Admin tests, `node scripts/phase2-db-test.mjs`, static/security preflights, `pnpm preflight`, `pnpm security:e2e`, `pnpm uat:gate`, TODO/backend test/RC/release gates, and `git diff --check`. All command logs are generated by `run-gates.mjs`.

Implementation checkpoint: 2027a18 (identity, scoped Core reads and integration evidence). Subsequent documentation checkpoint records whitespace verification; push both normally to the integration branch.

Member continuation implementation checkpoint: 0bdc0eac949f406fa46b9da2367035e2d43c5b8f. Normal push publishes it and the following report-only checkpoint to origin/integration/member-backend-mvp.


## UX-1 Design System + preserved Connected MVP — 2026-09-16

See ../ux/REPORT.md and UX-PASS-FAIL-MATRIX.md. Member 111 (106 existing +5), Admin 14 (11 existing +3), Backend API106 with73TODO, Member real HTTP/DB201x2, Replay129, Admin49HTTP PASS after API/Worker restoration. Six initial pages and24viewport references verified; Member screenshots mock visual-only, formal LIFF remains pending. Shared tokens/React adapters +Bootstrap Grid; no API/schema/business-rule changes. Remaining rollout and operational/release blockers are explicitly retained.

UX-1 source checkpoint: 5a05c3c9b722555955175451cbfa7db832681677; pushed origin/integration/member-backend-mvp. Final screenshot metadata is captured against this committed source. Follow-up evidence update changes documentation/reference metadata only.
