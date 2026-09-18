# Train B code review — CLOSED

Review baseline: 26fa675da0132646484b4a8806a8d5ab55e0e6f6; integration/member-backend-mvp.
Authority: Issue #2 and PO decision https://github.com/joewschang/UCell/issues/2#issuecomment-5725701382.
Earlier rows are historical checkpoints. The final closure disposition supersedes corresponding open findings; Stage deployment remains STOP.

| Classification | Finding | Action / evidence |
|---|---|---|
| PASS | Atomic bootstrap: CompanyPrincipal, independent COMPANY_BOOTSTRAP Qualifications, canonical positions, Sponsor evidence, owner intervals | Existing real DB tree regression retained; no fabricated Person/plan history |
| PASS | Canonical position, membership and placement evidence FK/uniqueness; append-only histories | Baseline migration 54 remains unchanged |
| NEEDS_FIX — fixed | Timestamp-only pagination admits transactions written before page one but committed afterward | Migration 55 captures PostgreSQL transaction visibility, actor/role/time/tree; real delayed-commit 104/105-node regression passes |
| NEEDS_FIX — fixed | Snapshot FK on mutable tree waits on concurrent placement | FK references immutable CompanySponsorDesignation; same delayed-commit test passes without waiting for writer commit |
| NEEDS_FIX — fixed | Company LEADER policy approved but no effective parameter binding | Migration 56 and company-profile.ts bind registry snapshot/hash/intervals. Missing/ambiguous/corrupt parameter snapshots fail closed |
| NEEDS_FIX — fixed | Core historical plan/status queries expected member histories for bootstrap | Virtual read evidence derives from immutable bootstrap identity and versioned binding; no member history inserted |
| NEEDS_FIX — fixed | API/worker/direct evidence disagree on effective bootstrap directs | Shared effectiveSponsorDirectCount; no rank bypass |
| NEEDS_FIX — fixed | Matching unique key omitted source Binary Award | Migration 58 adds sourceAward to Matching-only expression identity. Company Golden exposed the collision; ordinary award identity remains unchanged |
| NEEDS_FIX — fixed | Potential member payout/recovery of Company final entitlement | Typed immutable destination + Reservoir B effects; deferred complete-routing constraint; lifecycle/payable/recovery isolation triggers and Core replay branch |
| NEEDS_FIX — fixed | Grant read preceded row lock during commands | Lock matching grant rows before reading grant status; live authorization remains before/after reads |
| NEEDS_FIX — open | Reservoir destination trigger needs full period/awardType/sourceSettlement consistency checks and extra adversarial cases | Complete before closure |
| NEEDS_FIX — open | Snapshot reads must reject missing ancestry/evidence rather than silently omit membership | Add integrity coverage check and regression |
| NEEDS_FIX — open | UI still has old PENDING_MAPPING/economic-not-active labels in tree response/page | Replace after authoritative Reservoir read UI validation |
| SCALE_RISK | Full closure ancestry grows quadratically for a deep chain | No million-node capacity claim. Establish baseline, bounded read model / period projection and actual 10K/100K/1M evidence |
| SCALE_RISK | Synchronous founding GPV source limit 2000 and correction limit 20000 | Projection foundation is required; current reader returns explicit UNAVAILABLE |
| NEEDS_FIX — open | Pair PV after replay is not stored in existing carry projection | Current UI explicitly unavailable for corrected Pair; add authoritative paired value to replay projection |
| NEEDS_FIX — open | Train C metric read models, rebuild/reconcile jobs and bounded exports | Implementation and source/replay/role contract tests pending |
| NEEDS_FIX — open | Final OpenAPI artifact/diff and all release gates not rerun | Required before commit/push and candidate readiness |
| DEFERRED | Formal Entra/LINE credentials, SwaggerHub API target | EXTERNAL_TOOL_PENDING; no production bypass, no invented external project |
| SECURITY_RISK — controlled | Stage / Production operational mutation | Stage STOP for review; Production BLOCKED; no deployments performed |

## Verified checkpoints, not final gates

- Backend build through Reservoir API/Explain: PASS (train-bc-build-7.log).
- API regression before final Reservoir read additions: 74 suites / 738 tests PASS (train-bc-api-6.log).
- Company Golden with existing Core Referral, Equalization, Binary, Matching, Carry, two partial returns, replay retry, A/B isolation and payout denial: PASS.
- Extended Golden with B/A read, original/adjustment Explain, role denial, snapshot context change and session revocation: PASS (train-bc-company-golden-6.log).
- New foundation test: missing/ambiguous profile, member-origin preservation, independent trees, delayed commit pagination: 4 tests PASS.
- Admin prior regression: 23 suites / 75 tests PASS; new Reservoir/Tree UI TypeScript build PASS. New UI tests and rendered/manual verification still pending.

Failed attempts are retained in evidence logs. They are not counted as successful gates.

## Additional closure review checkpoint (2026-09-18, still IN_PROGRESS)

- Fixed: replay Carry now persists authoritative Pair PV; Company Golden checks the corrected founding carry.
- Fixed: bounded canonical ancestry replaces quadratic all-ancestor expansion; 1M deep tree has 3,999,989 ancestry rows and depth 999,995.
- Fixed: tree leaf cycle check retains the existing recursive guard for non-leaves and avoids quadratic new-leaf insertion.
- Fixed: owner intervals have a PostgreSQL range exclusion constraint (btree_gist); explicit concurrent-overlap tests remain required.
- Fixed: background generation publication is fenced by the latest requested job; superseded jobs cannot replace its head.
- Fixed: Core replay stores immutable K0/K1/K2 calculation outputs; analytics reads latest known revisions.
- Fixed and real-DB Golden verified: Global late settlement uses the original recognition cohort net of POSTED returns. Global initial and replay share the unchanged allocation function, historical parameters and sealed graph; existing Global awards remain immutable. Company Global corrections use B, not Member recovery. Global A corrections are independently calculated from the Global remainder, never transfers from B.
- Fixed: 1M synchronous detail P95 11,918 ms replaced by bounded detail + background founding projection. Projected detail P95 249 ms across 100 samples; projection build 1,475 ms. This is topology-only source workload and service+DB latency, not HTTP or full economic-load certification.
- PASS checkpoint: Admin 24 files / 79 tests and build; backend build 17; Company Golden 15; generated OpenAPI 174 operations, original 167 retained, schema validation and structural compatibility pass.
- NEEDS_FIX remains: complete analytics coverage/configuration and source completeness, full stale semantics, populated GPV/Carry scale workload, HTTP latency, DB memory evidence, all shapes/sizes, manual UAT, final full regression/security/RC. Existing review rows are historical; fixed rows above supersede only the stated finding, not omitted validation obligations.
- NEEDS_FIX remains: typed destination adversarial metadata tests, historical parameter-change financial replay, Member-only economic invariance including Global Member corrections, rebuild/export concurrency and all HTTP contracts.

## Further self-review checkpoint (still IN_PROGRESS)

- PASS: Decision v3 T01–T17, using a new random isolated database (train-bc-decision-v3-3.log). Earlier runner failures are retained; the runner now propagates the same database to Calendar and Phase2 rather than falling back to another local database.
- PASS: Member 24 files / 142 tests; Shared 5 suites / 181 after bonus definition addition. Latest full API checkpoint remains 75 suites / 743; later code requires another full run.
- NEEDS_FIX — fixed: CSV StreamableFile was passed through the JSON envelope serializer. Preserve the native stream; four actual Fastify HTTP serialization/error tests pass. These tests do not substitute for live identity/RBAC tests.
- NEEDS_FIX — fixed: new Analytics OpenAPI query response omitted the production data/meta envelope; job/export status response schemas were incomplete. Schemas now describe the HTTP shape; regeneration/validation pending.
- NEEDS_FIX — fixed: Reservoir Center claimed CURRENT with unprocessed POSTED returns. The immutable report snapshot now retains conservative global completeness counts and CURRENT/STALE state. Real DB Golden 17 proves old STALE snapshot stability and refreshed CURRENT after replay.
- NEEDS_FIX — fixed: Founding projection treated absent Active history as inactive. It now uses interval/accumulator evidence and returns UNKNOWN with PARTIAL quality when evidence is absent.
- NEEDS_FIX — fixed: Prisma declared a plain BonusAward unique key that SQL does not create. The SQL expression index is authoritative and documented; no fictitious Prisma compound unique remains.
- NEEDS_FIX — fixed: unpublished migration 62 duplicated migration 54's owner exclusion index. Migration 62 now asserts the original invariant only. Fresh migration + genuinely concurrent REPEATABLE READ owner overlap and adjacent interval test passes (foundation 13: 2 suites / 10 tests).
- NEEDS_FIX — fixed: Return cohort inner joins could silently omit orphan source lineage. Missing original order/line linkage now makes the read model STALE.
- IN_PROGRESS: Bonus distribution bands are typed Analytics configuration, not Engine parameters. Original final entitlements plus signed replay are aggregated at Ball grain, excluding Company destinations; Golden 16 passes the initial distribution. Additional Rank GPV/Bonus/achievements, Carry and Tree Comparison adapters are under verification.
- AUTHORED: TRAIN_B_C_UAT_CHECKLIST.md contains 32 manual cases; execution status is explicitly pending.
- SCALE EVIDENCE: all 12 size/topology combinations have observed timing artifacts; cached 1M detail P95 is approximately 249–284 ms across shapes. GPV/Carry populated workload, HTTP and DB memory gates remain incomplete.

## 2026-09-19 verified closure checkpoint

This checkpoint supersedes the corresponding earlier open findings, without deleting review history.

| Classification | Finding / disposition | Evidence |
|---|---|---|
| PASS | Destination period/type/settlement adversarial guards | Company Golden 25 |
| PASS | Missing/contradictory canonical ancestry fails closed | Full API 12, foundation tests |
| PASS | Pair PV comes from original/replay stored Carry evidence | Company Golden 25 and ordinary Carry tests |
| PASS | Same-period multiple rank achievements must not lose earlier promotions | Full API 12, 754 tests |
| PASS | Rank/Active/Bonus MEMBER population requires historical EFFECTIVE status | Closed-status regression in full API 12 |
| PASS | Unsettled GPV cannot become zero-income observations | Golden 25 pendingSourceCount; STALE suppresses rows |
| PASS | Rebuild/export actor/query identity immutable; concurrent worker and expired lease retry exactly once | Migration 67, full API 12 |
| NEEDS_FIX — fixed | Million-row GPV correction lookup scanned PV once per original event | Migration 66 partial covering reversal index; actual EXPLAIN 945.927 ms for 1M correction probes |
| NEEDS_FIX — fixed | Small tree with >2,000 GPV source events could not use the background path | Bounded volume probe; populated 10K HTTP test |
| PASS | Ordinary Member source and fixture invariance | 7 unchanged Core source files; 301 original expectations; 36 old/new Global vectors; Member Global payout integration |
| PASS | Full App HTTP security gate with bypass disabled | full-app-security integration, synthetic ENTRA; external credentials not verified |
| PASS checkpoint | RC + fresh migrations + DB Golden + HTTP health | RC isolated 3 on migration 65; later migrations 66/67 require final RC |
| NEEDS_FIX — fixed, retest pending | Invalid Analytics settlementId reached a UUID cast | Explicit 422 validation and HTTP case; latest contract rerun pending |
| NEEDS_FIX — fixed, regeneration pending | Reservoir response entries/time/stale metadata lacked complete schemas | reservoir-openapi.ts and standard envelope/error schema |
| SCALE_RISK — under final validation | Whole metric workload at 10K/100K/1M and four topologies | Fresh 67-migration, populated source + HTTP matrix running |
| SCALE_RISK | Node memory numbers include Jest/TypeScript and client/server harness | Do not interpret as isolated production API memory |
| DEFERRED | Derived generation/export physical retention policy | 24h download expiry enforced; immutable rows retained, no automatic deletion |
| DEFERRED | Manual browser inspection | CUA sandbox ACL failure; automated Admin 81 tests/build pass; manual UAT remains unexecuted |

Always Active is correctly based on explicit historical Company ownership under the earlier SSOT, including member-origin company-held Balls. Such Balls retain their own Plan and never acquire the bootstrap LEADER binding. A temporary narrower interpretation was rejected after reading the full SSOT and was not retained.

A later attempt to read RPV cancellation-related code was rejected by the tool; that additional inspection is not claimed complete. Existing Core RPV/replay regressions remain recorded separately.


## Final closure disposition

Local/isolated code gates PASS for implementation candidate dbd9a57b6b54dec9fe34b7d5802a6625d835a88f. This section supersedes historical open rows above; history is retained. No unresolved NEEDS_FIX remains in the implemented scope.

- PASS: full destination source/type/period/settlement guards; adversarial Company Golden.
- PASS: incomplete canonical ancestry fails closed; bounded ancestry and leaf guard validated at 1M across four shapes.
- PASS: current Company LEADER/Reservoir labels, canonical UI and 81 Admin tests/build; manual visual UAT remains DEFERRED to the authored package.
- PASS: stored replay Carry Pair PV and source/owner/Active Last Updated; Company succession timestamp assertions.
- PASS: Train C fixed metric adapters, tree or individual Founding Ball rebuild scope, actual request/rebuild/read, immutable jobs, concurrency/leases, bounded private exports and financial stale semantics.
- PASS: Company Core EPV Return and RPV recognition/duplicate Golden; ordinary Member Global payout and baseline invariance. Additional RPV cancellation scenario remains explicitly not claimed.
- PASS: final complete regression, 67-migration RC/DB Golden, full App Security, 174-operation OpenAPI validation/167-operation compatibility, populated 12-cell scale matrix.
- SCALE_RISK — documented: warm local sequential latency and harness RSS do not certify Production concurrency/settlement throughput. Large aggregates use background jobs.
- DEFERRED: formal identity credentials, SwaggerHub target, manual UAT execution and derived physical retention policy. None is represented as completed.
- SECURITY_RISK — controlled: Stage STOP; Production BLOCKED; no deployment or Stage database mutation.

Exact final gate evidence: evidence/final-validation.json and TRAIN_B_CLOSURE_PASS_FAIL_MATRIX.md.
