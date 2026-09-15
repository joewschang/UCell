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
