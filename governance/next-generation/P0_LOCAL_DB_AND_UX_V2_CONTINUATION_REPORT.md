# P0 local database and UX v2 continuation report

**Recorded:** 2026-09-19
**Scope:** local persistent database convergence and Member/Admin UX v2 continuation only. This is evidence for local work; it is not a Stage or Production approval.

## 1. Persistent local database convergence

The persistent local PostgreSQL database `ucell` was backed up before its upgrade. The backup was restored into a separately created disposable database, checked, and then removed; the restore contained 52 applied migrations and 12 `identity.person` rows. The persistent database was then upgraded through the current migration set.

| Evidence | Result |
|---|---|
| Backup | `C:\\UCell\\backups\\ucell-pre-migration-69-20260919-213525.dump` |
| Backup size / SHA-256 | 1,188,166 bytes / `27DD95AC12F45AE5F8A4742B820F9E52B6FC87C20ED8C297A79B61D24C4DB3EB` |
| Current migration status | Prisma reports 69 migrations and `Database schema is up to date` |
| Migration history | 69 completed migrations; 1 historical rolled-back lineage record; 70 history rows total |
| Current identifier integrity | 12 people, 0 missing/invalid Member Numbers, 12 distinct Member Numbers |
| Current tree data | 0 Binary Trees and 0 memberships; the upgrade did not create synthetic production-like tree facts in `ucell` |
| P0 reconstruction check | `READ_ONLY_DRY_RUN` PASS: no missing/invalid Member Number, Binary position, duplicate position, or Ball Number mismatch |

The historical rolled-back record is retained provenance in Prisma migration history. It does not prevent the current 69-migration schema from being up to date.

## 2. P0 identifier correction

The read-only reconstruction check now treats six digits as a minimum ordinal width rather than a maximum. PostgreSQL `lpad` truncates longer input, so the prior comparison could falsely reconstruct a Ball Number after position ordinals passed six digits. The correction is aligned with migration 69 and the authoritative allocator.

The isolated database test constructs a valid path through binary position `1,000,003`; its non-bootstrap ordinal is `1,000,000` and the expected Ball Number grows naturally to `treeCode + 1000000`. The test then runs the same reconstruction script and requires `PASS`.

## 3. UX v2 corrections

### Company LEADER and Always Active presentation

- Canonical tree nodes show `LEADER` only when a non-empty Ball in bootstrap position #1–#3 has Company ownership and a complete available server binding for `LEADER` with a profile version.
- Creating a Binary Tree now captures the uniquely effective Core parameter snapshot at the tree effective time and atomically seals all three Company bootstrap bindings. Missing, ambiguous, or corrupt binding evidence causes creation to roll back rather than creating an implied LEADER Company Ball.
- `Always Active` is displayed only from the server-provided Company ownership evidence. It is separate from LEADER and does not bypass Global rank.
- Company-held member-origin Balls, including #4–#7, remain Company-held and may be Always Active, but display as non-Bootstrap and retain their original Plan. They never acquire LEADER by implication.
- Ball 360 validates the sealed bootstrap binding: qualification kind, Company owner, binding source, LEADER plan, exact `COMPANY_BOOTSTRAP_PROFILE_V1`, and a valid effective interval. Missing or ambiguous evidence fails closed.
- The qualification list does not receive the complete 360 binding, so it deliberately uses neutral “confirm in Ball 360” labels instead of asserting Always Active or LEADER from raw holder fields.
- A position with a Qualification but no usable Ball Number is rendered as occupied with unavailable evidence and cannot be selected as a placement parent. It never becomes `AVAILABLE` through a missing identifier.

### Member experience and privacy

- The repurchase-detail action now uses the shared `UCellButton`, preserving keyboard/button semantics and accessible expanded-state linkage.
- Member tree reads remain bound to a server snapshot token and reject changed snapshots, mismatched parents, internal identifiers, or Company economic payloads.
- Member headers, tree, and award views continue to show public Member/Ball identifiers and do not render internal Qualification or order UUIDs.

### Local Admin test boundary

The isolated full-access DEV entrypoint no longer manufactures an `ADMIN_LOCAL` principal. It resolves a real, synthetic **Entra** identity link, one active time-valid Entra grant, and one matching unrevoked Entra session. Invalid actor input, missing facts, ambiguity, role mismatch, or use outside development fail closed with 401. The entrypoint is for `ucell_admin_test` only; normal production authentication and tree authorization remain unchanged.

## 4. Current verification evidence

| Check | Result |
|---|---|
| Persistent DB migration status | PASS — 69 migrations, up to date |
| Persistent P0 reconstruction dry run | PASS — read-only, all anomaly counts zero |
| Fresh isolated P0 identifier DB suite | PASS — 4 tests, including natural seven-digit ordinal growth |
| Isolated Admin DEV Entra-principal suite | PASS — 9 tests, including ambiguity, blank subjects, and fail-closed cases |
| API Admin DEV build | PASS |
| Admin unit/UI regression | PASS — 28 files / 106 tests |
| Admin production build | PASS |
| Member unit/UI regression | PASS — 26 files / 149 tests |
| Member production build | PASS |
| Browser interaction evidence | Member public identifier, snapshot-safe tree, pending settlement/explain states, and privacy behavior were manually checked; Admin read-only tree access returns a safe 403 without restricted data leakage |
| Connected Admin full smoke | PASS — two consecutive isolated runs, 49 requests each; `SALE_CONFIRMED` processed with GPV and historical replay snapshot |
| Fresh Company LEADER binding foundation | PASS — 154 phase-2 assertions; focused 7/7; new isolated browser tree visibly resolves #1–#3 to LEADER and Always Active |
| Migration / OpenAPI / security preflight | PASS — migration preflight, OpenAPI preflight, and security policy preflight |

The connected Admin smoke harness provisions only isolated synthetic Entra facts. It creates or reuses a prospective R1.0B product profile with a sealed parameter snapshot, waits for the real isolated worker to process `SALE_CONFIRMED`, and verifies that historical replay evidence exists before a return path can proceed. Legacy seed products without historical snapshot evidence remain fail closed.

## 5. Browser UAT evidence

Using the isolated full-access Admin entrypoint, the browser created and activated one draft tree, then created a separate `UX V2 LEADER Binding Browser Tree` after the binding fix. The latter visibly showed #1, #2, and #3 as Company Balls with `LEADER` and `Always Active`; #4–#7 remained `AVAILABLE`. The tree viewer returned a fixed server snapshot identity, and unprovided GPV and Carry metrics rendered as unavailable rather than zero. Reservoir Center showed separate A and B sections; B remained an empty, stale authoritative ledger rather than a fabricated balance.

## 6. Boundaries and remaining external gates

- **Stage deployment: STOP.** No Stage container update, database migration, or environment change was performed.
- **Production: BLOCKED.** No Production deployment or credential bypass was created.
- Formal LINE/LIFF and Entra credentials remain an external identity blocker. The local synthetic Entra facts validate code paths only and are not a substitute for formal credential-backed verification.
- Large-tree scale matrix is outside this execution scope, as directed. No 10K/100K/1M result is claimed here.
- LLM, RAG, and Vector DB work remain outside this continuation.
