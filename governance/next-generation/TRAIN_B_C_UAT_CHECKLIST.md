# Train B/C manual UAT checklist

Status: AUTHORED — EXECUTION_PENDING. This document is not UAT acceptance or deployment approval.
Authority: Issue #2, all comments, latest LEADER decision 5725701382; governance/ux-v2 and sa-decisions.

Use synthetic data in a disposable local/isolated database. Stage execution requires separate approval.
Roles: SUPER_ADMIN, MEMBERSHIP_OPS, FINANCE, COMPLIANCE_AUDIT, ORDER_OPS, ordinary MEMBER.
Record actual actor, candidate commit, database migration count, browser, timestamp, request/correlation IDs, snapshot IDs and evidence for each result. Do not record tokens or personal data.

| ID | Action | Expected result | Execution |
|---|---|---|---|
| U01 | Open Tree List with authorized role; exercise loading, empty and server error | Clear loading/empty/error states; retry does not invent rows | PENDING |
| U02 | Create Tree using unique idempotency key; repeat request | One tree and three independent company Qualifications; repeat returns same result | PENDING |
| U03 | Inspect #1–#7 and Tree Detail | #1 root, #2 left, #3 right; #4–#7 vacant/member; company badges show 領袖 and Always Active | PENDING |
| U04 | Inspect each company profile and a second tree | Each #1/#2/#3 resolves effective LEADER binding/hash; no automatic Global rank | PENDING |
| U05 | Change tree name/settings and inspect history | Version increases; actor/reason/effective evidence retained | PENDING |
| U06 | Activate tree and inspect lifecycle | Allowed transition only; historical state still readable | PENDING |
| U07 | Confirm founding member Sponsor | Company sponsor designation and actual Sponsor sequence visible; no unconfirmed placement | PENDING |
| U08 | Preflight valid #4/#5/#6/#7 placements, then confirm | Expected parent/side and reserved position shown; atomic confirmation and evidence | PENDING |
| U09 | Try first actual Sponsor referral outside its Sponsor left subtree | Explicit rejection with reason; no placement/owner mutation | PENDING |
| U10 | Try third actual Sponsor referral outside its Sponsor left subtree | Explicit rejection per approved left/right rule; no partial placement | PENDING |
| U11 | Place same ball twice / retry identical request | No duplicate membership, position or evidence | PENDING |
| U12 | Use stale expectedVersion from another browser | HTTP 409; actionable refresh; unsaved input retained where applicable | PENDING |
| U13 | Invalid payload/time/placement | HTTP 422; field/domain reason visible; no write | PENDING |
| U14 | Close tree; attempt new placement; archive | Lifecycle restrictions enforced; archived evidence remains readable | PENDING |
| U15 | Inspect all four founding statistics | Position, Qualification, Holder, Active, descendants excluding self, left/right, new counts, GPV, Carry, Pair PV, Last Updated, Data Through and quality | PENDING |
| U16 | Transfer holder/company succession | New-ball counts unchanged; member-origin Plan remains original | PENDING |
| U17 | Missing Active / Carry evidence | Unknown/unavailable displayed, never substituted with inactive/zero | PENDING |
| U18 | Page 1, concurrent placement, page 2 | Same snapshot, no duplicates/missing/drift; refresh gives new snapshot | PENDING |
| U19 | Expand child nodes and change asOf | Bounded server reads, same snapshot; no browser full-tree recursion | PENDING |
| U20 | Large tree without current projection | Explicit STALE/unavailable stats; enqueue rebuild with authorized actor | PENDING |
| U21 | Run rebuild worker; check job; reload | Immutable generation, dataThrough/projectedAt/projectionVersion; dry-run publishes nothing; reconcile agrees | PENDING |
| U22 | Open Reservoir A and B | Separate sections; A Global remainder, B Company final entitlements; no transfer/payout action | PENDING |
| U23 | Filter B by period/tree/#1–#3/award type and paginate | Server period/net/cumulative figures and fixed snapshot; max 100 rows/page | PENDING |
| U24 | Open Explain B original and replay entry | Source Recognition, Theory, K, Final, profile/tree/position, versions/hash/evidence; no frontend calculation | PENDING |
| U25 | POST partial and multiple returns; retry/replay | Original B effect unchanged; signed adjustments once; no Company Member clawback/payout | PENDING |
| U26 | Query while Return/replay pending, then complete replay | STALE warning; old snapshot remains stable; new snapshot becomes CURRENT | PENDING |
| U27 | Query Analytics return/rank/active/bonus/tree/K/A/B | Definition version, grain/population/boundaries/evidence; zero denominator null; stale never current | PENDING |
| U28 | Request large CSV export and download | Background job states, bounded chunks, source snapshot/filter/definition provenance; no browser all-pages pull | PENDING |
| U29 | Download another actor export or expired export | BOLA denial / expired response; no content disclosure | PENDING |
| U30 | ORDER_OPS/MEMBER attempts admin finance and tree writes | HTTP 403; denied UI with no prior sensitive data retained | PENDING |
| U31 | Revoke role/session between request and worker/read | Denial before publication/download; no newly leaked data | PENDING |
| U32 | Expire session while viewing detail/confirming placement | Session-expired flow; no silent bypass or double mutation | PENDING |

## Local worker procedure

Build backend before running `node scripts/period-projection-worker.mjs` from backend, with DATABASE_URL explicitly pointing to the disposable local database.
UCELL_PERIOD_WORKER_MAX_JOBS is 1–100 (default 1); each iteration handles at most one projection and one export.
For continuous local UAT processing, run `pnpm analytics:worker` (or append `--watch`). It polls the queue at UCELL_PERIOD_WORKER_POLL_MS, default 5000, validates 1000–60000, and drains the current job on SIGINT/SIGTERM. Keep this dedicated process separate from the monetary outbox worker. Stage hosting of this command remains an explicit deployment review item; no scheduler or deployment is created here.
Keep credentials in the runtime environment, never in checked-in evidence.

## Evidence and acceptance

An automated equivalent can supplement each case but does not mark manual execution PASS.
PENDING entries require recorded execution or explicit disposition before manual UAT acceptance. Checklist readiness is distinct from completed UAT.
Stage STOP; Production BLOCKED. No Stage migration/deployment is authorized by this checklist.
