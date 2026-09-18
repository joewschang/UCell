# Train B non-monetary foundation checkpoint

This is an implementation checkpoint, not a declaration that the entire Next Generation program or every proposed scale/export feature is complete. The original instruction attachment ends midway through section 37; its continuation has been requested. Company monetary activation remains PENDING_MAPPING.

## Implemented behavior

- Migration 54 adds explicit CompanyPrincipal, owner intervals, immutable Qualification kind, BinaryTree/status history, memberships, seven canonical positions, founding occupation, Company Sponsor designation, placement evidence, ancestry and projection checkpoint. Original 53 migrations are unchanged. A CompanyPrincipal is not a Person. Member-origin company-held qualifications retain their identity, kind and plan.
- A serializable, idempotent bootstrap creates exactly three real Company qualifications and seven canonical positions. Company balls have no fabricated member holder or plan. #2 and #3 are Sponsor sequences 1 and 2 and occupy root LEFT/RIGHT. Empty #4–#7 have no fabricated Qualification.
- The first/third actual Sponsor LEFT-subtree rule remains active. All 24 founding occupation orders are tested. If the first actual member recruit (sequence 3) selects #6/#7, placement is rejected and sequence 3 is retained; #4/#5 satisfy the root's LEFT subtree. No renumbering or Company bypass was introduced.
- The four existing Binary writers use the common tree-aware insertion boundary. Tree placement does not mutate Sponsor. Company Sponsor confirmation is a separate command. The Admin console adds version/holder/Sponsor-bound preflight and expected-version checks; pending setup, placement evidence and qualification status are completed atomically when a setup exists. Existing sponsor-owner, 72-hour escalation and system-assignment entry paths remain.
- SUPER_ADMIN manages trees; SUPER_ADMIN or QUALIFICATION_PLACEMENT_OVERRIDE places; MEMBERSHIP_OPS may confirm Sponsor and read. COMPLIANCE_AUDIT reads. Commands and reads require live Entra session/identity/grant evidence; development bypass principals are denied by these new services. Commands recheck authorization before commit and before replaying cached results.
- DRAFT, ACTIVE, CLOSED_TO_NEW and ARCHIVED transitions are explicit and versioned. No tree delete or code reuse. SQL validates canonical membership/occupation/Sponsor evidence and blocks bootstrap holder/plan histories and Award/Payable activation. Archived tree owner intervals cannot mutate. Owner EXIT/retransfer uses existing review workflows; new tree owners use explicit CompanyPrincipal intervals, while old legacy company-Person histories are not guessed or rewritten.
- Structural reads use effective time plus recorded-time cutoff. Founder descendant counts exclude self, span all depths, partition LEFT/RIGHT, and count first placements for period growth. Holder transfers do not create new balls. Empty slots return null metrics, not imaginary zero-valued balls. A fourteen-generation DB fixture verifies that counts and node readback do not stop at generation twelve.
- GPV reports read original sealed events once, validate captured historical Binary paths and original quantities, and attribute linked POSTED return/replay corrections to the original recognition period. Decimal arithmetic retains four ledger decimals. Missing/corrupt/unfinished evidence returns UNAVAILABLE. Source bounds are explicit (2,000 originals / 20,000 corrections), not partial totals.
- Carry reads select finalized original evidence or stored replay projection values. Missing seals, conflicting rule versions or pending/incomplete replay return UNAVAILABLE. No settlement, entitlement or payout calculation is called by these readers.
- Tree outbox events use existing compare-and-swap leases and fenced transactions. Their committed projection watermark is verified before acknowledgement. Duplicate/out-of-order delivery, expired/reclaimed leases and incomplete projections have regression coverage.
- Admin > Organization now includes tree list, detail/settings, seven-position viewer, founding counts/GPV/Carry, explicit placement and a complete-node paginated view (100 nodes per response, total reported separately). New tree pages and existing qualification pages display Always Active (Company Rule) for explicit Company ownership; no fabricated NT$2,000 progress is shown.

## Validation and evidence

Final normalized command outputs are stored in `evidence/train-b-*`. Latest full API reached 73 suites / 734 tests; Admin 23 files / 75 tests; Member 24 / 142; Shared 5 / 181. Fresh isolated DB runs apply all 54 migrations and execute 154 original DB assertions before API tests. Final RC and migration verification are recorded separately after the last SQL constraint edit. Decision v3 T01–T17 passed. Old OpenAPI paths and component schemas compare unchanged against Train A, with eight added tree operations.

No Stage/Production deployment, real-provider certification, formal UAT, Company profile binding, Reservoir B monetary activation or AI provider/RAG work was performed. Frontend verification is automated component testing and production build, not a claimed manual browser UAT. The existing bundle-size warning remains.

## Remaining scope and operating limits

- Exact COMPANY_BOOTSTRAP_PROFILE_V1 binding still requires the approved business mapping. No highest-plan/rank/free entitlement substitution.
- This checkpoint uses transactional ancestry and source-validated bounded metric reads. Large/skewed 10K/100K/1M workloads, dedicated period aggregate generations, asynchronous rebuild/export and performance certification remain unimplemented or unverified. Over-limit metric reads explicitly return UNAVAILABLE; do not claim production scale readiness.
- Node pagination uses an explicit AsOfContext and keyset. A durable projection-generation context across separate requests and adversarial long-running commits still needs the proposed large-tree snapshot work; no claim of that concurrency acceptance gate is made here.
- Legacy management analytics cannot treat Company identities as Persons. Company-only roots are not inserted as fake people into that older analytics model; tree-specific reads are the supported path.
- Tree ownership changes are commit-time operations. Arbitrary future/backdated owner schedules are rejected rather than changing current owner ahead of the interval.
- The detailed governance proposals contain additional tree-wide analytics, exports, company-income/reconciliation panels and scale acceptance scenarios beyond this foundation. Those are not marked complete.

## Recovery and failed attempts

Repeated power failures preserved source and the pushed Train A checkpoint 323bf85. Work runs in C:/UCell/next-generation, integration/member-backend-mvp. Upstream provider enablement commit 755a2a0 was fast-forwarded without overwriting Train B work.

A bare API test command initially lacked isolation environment variables. The legacy inventory test defaulted to port 5432/ucell_admin_test, created a synthetic Person and then failed because Qualification.kind was absent. No migration or destructive cleanup was applied there. That run is excluded from PASS evidence. Subsequent tests use dedicated port 55432 and freshly created/dropped test databases.

Other excluded failures: old test doubles lacked the new common placement method; a deep-tree fixture had a narrow randomUUID string type; new Admin metric fields needed nullable typing; the first v3 attempt used a database name rejected by legacy Phase 2. These were corrected and rerun, without weakening database safety checks. V3 used its *_test database plus a disposable allowed-name Phase 2 clone.

Old drafts of migration 54 remain applied only in task-owned scratch databases. Always validate the committed migration from a fresh isolated database. Never repair a published migration checksum or migrate original port 5432. The final scratch database name and commit checkpoint are recorded in TRAIN_B_RECOVERY.md.
